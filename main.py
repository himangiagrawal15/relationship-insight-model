from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import re
from collections import defaultdict, Counter
import json
import os

# Import ML models
from transformers import pipeline
import numpy as np

# NEW: Import Gemini
import google.generativeai as genai

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML models
print("Loading models...")
sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

# NEW: Initialize Gemini (set your API key as environment variable)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your-api-key-here")
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-pro')

print("Models loaded!")

# In-memory storage with caching
conversations_db = {}
conversation_counter = 0
gemini_cache = {}  # Cache Gemini responses

# Pydantic models
class ChatUpload(BaseModel):
    chat_text: str
    title: str

class Message(BaseModel):
    timestamp: datetime
    sender: str
    content: str
    sentiment: Optional[str] = None
    score: Optional[float] = None

class Conversation(BaseModel):
    id: int
    title: str
    person1_name: str
    person2_name: str
    message_count: int
    messages: List[Message] = []

# Helper functions
def parse_chat_text(chat_text: str):
    """Parse WhatsApp/Telegram chat format"""
    messages = []
    
    patterns = [
        r'(\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*-\s*([^:]+):\s*(.+)',
        r'\[(\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM|am|pm)?)\]\s*([^:]+):\s*(.+)',
        r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*-\s*([^:]+):\s*(.+)',
    ]
    
    for line in chat_text.split('\n'):
        line = line.strip()
        if not line:
            continue
            
        matched = False
        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                timestamp_str, sender, content = match.groups()
                
                try:
                    for fmt in ['%m/%d/%y, %I:%M %p', '%m/%d/%Y, %I:%M %p', '%d/%m/%y, %H:%M', 
                               '%Y-%m-%d %H:%M:%S', '%m/%d/%y, %H:%M']:
                        try:
                            timestamp = datetime.strptime(timestamp_str.strip(), fmt)
                            break
                        except:
                            continue
                    else:
                        timestamp = datetime.now()
                except:
                    timestamp = datetime.now()
                
                messages.append({
                    'timestamp': timestamp,
                    'sender': sender.strip(),
                    'content': content.strip()
                })
                matched = True
                break
    
    return messages
# ADD this new endpoint:
from fastapi import BackgroundTasks

analysis_status = {}  # Track progress

def background_analyze(conv_id: int):
    """Run analysis in background"""
    analysis_status[conv_id] = {'status': 'processing', 'progress': 0}
    
    conv = conversations_db[conv_id]
    messages = conv['messages']
    total = len(messages)
    
    # Batch sentiment analysis with progress
    batch_size = 32
    for i in range(0, total, batch_size):
        batch = messages[i:i+batch_size]
        texts = [msg['content'][:512] for msg in batch]
        results = sentiment_analyzer(texts)
        
        for msg, result in zip(batch, results):
            msg['sentiment'] = result['label'].lower()
            msg['score'] = result['score']
        
        # Update progress
        analysis_status[conv_id]['progress'] = int((i / total) * 100)
    
    analysis_status[conv_id] = {'status': 'complete', 'progress': 100}

# MODIFY your analyze endpoint:
@app.post("/api/conversations/{conv_id}/analyze/")
def analyze_conversation(conv_id: int, background_tasks: BackgroundTasks):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    background_tasks.add_task(background_analyze, conv_id)
    return {'status': 'started', 'message': 'Analysis running in background'}

# ADD progress check endpoint:
@app.get("/api/conversations/{conv_id}/analysis_status/")
def get_analysis_status(conv_id: int):
    return analysis_status.get(conv_id, {'status': 'not_started', 'progress': 0})
def detect_sentiment(text: str):
    """Enhanced sentiment detection"""
    result = sentiment_analyzer(text[:512])[0]
    
    sentiment_map = {
        'POSITIVE': 'positive',
        'NEGATIVE': 'negative'
    }
    
    sentiment = sentiment_map.get(result['label'], 'neutral')
    score = result['score']
    
    text_lower = text.lower()
    
    # Enhanced emotion detection
    if any(word in text_lower for word in ['love', '❤', '😍', '💕', '💖', 'miss you', 'baby', 'sweetheart', 'darling']):
        sentiment = 'love'
        score = min(score + 0.2, 1.0)
    elif any(word in text_lower for word in ['haha', '😂', '🤣', 'lol', 'funny', 'hilarious']):
        sentiment = 'happy'
    elif any(word in text_lower for word in ['cute', '🥰', 'adorable', 'sweet', 'aww']):
        sentiment = 'cute'
    elif any(word in text_lower for word in ['sad', '😢', '😭', 'crying', 'depressed', 'down']):
        sentiment = 'sad'
        score = min(score + 0.1, 1.0)
    
    return sentiment, score

# OPTIMIZED: Only call Gemini for significant fights
def analyze_fight_with_gemini(fight_messages, fight_id):
    """Use Gemini SPARINGLY - only for major conflicts"""
    # Check cache first
    cache_key = f"fight_{fight_id}"
    if cache_key in gemini_cache:
        return gemini_cache[cache_key]
    
    try:
        # Only analyze first 8 messages to save tokens
        context = "\n".join([f"{m['sender']}: {m['content'][:80]}" for m in fight_messages[:8]])
        
        prompt = f"""Analyze this relationship conflict briefly:

{context}

In 3 short sentences provide:
1. Root cause
2. Pattern observed  
3. Constructive advice

Keep under 100 words."""

        response = gemini_model.generate_content(prompt)
        result = response.text
        
        # Cache the response
        gemini_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"Gemini error: {e}")
        return "Conflict detected. Open communication helps resolve tensions."

def detect_fights(messages):
    """Enhanced fight detection - only use Gemini for severe conflicts"""
    fights = []
    
    fight_keywords = [
        'always', 'never', 'angry', 'upset', 'annoyed', 'frustrated', 
        'why do you', "you don't", 'tired of', 'enough', 'stop', 'serious',
        'whatever', 'fine', 'forget it', 'leave me alone'
    ]
    
    i = 0
    fight_counter = 0
    while i < len(messages):
        msg = messages[i]
        content_lower = msg['content'].lower()
        
        if (any(keyword in content_lower for keyword in fight_keywords) or
            msg['content'].isupper() and len(msg['content']) > 10 or
            msg.get('sentiment') == 'negative' and msg.get('score', 0) > 0.8):
            
            start_idx = max(0, i - 2)
            end_idx = min(len(messages), i + 10)
            fight_messages = messages[start_idx:end_idx]
            
            negative_count = sum(1 for m in fight_messages if m.get('sentiment') == 'negative')
            
            if negative_count >= 2:
                fight_counter += 1
                
                # OPTIMIZATION: Only use Gemini for severe fights (severity >= 3)
                if negative_count >= 3:
                    ai_summary = analyze_fight_with_gemini(fight_messages, fight_counter)
                else:
                    # Use simple summary for minor conflicts
                    ai_summary = "Minor disagreement. Communication can help clear misunderstandings."
                
                fights.append({
                    'start_time': msg['timestamp'].isoformat(),
                    'severity': min(negative_count, 5),
                    'trigger_phrase': msg['content'][:100],
                    'ai_summary': ai_summary
                })
                
                i = end_idx
                continue
        
        i += 1
    
    return fights

def detect_topics(messages):
    """Enhanced topic detection"""
    topic_keywords = {
        'Food & Dining': ['food', 'eat', 'dinner', 'lunch', 'breakfast', 'restaurant', 'cooking', 'hungry', 'pizza', 'coffee', 'meal'],
        'Work & Career': ['work', 'job', 'meeting', 'boss', 'office', 'project', 'deadline', 'client', 'career', 'presentation'],
        'Travel & Plans': ['trip', 'travel', 'vacation', 'visit', 'go to', 'plan', 'weekend', 'holiday', 'flight', 'hotel'],
        'Entertainment': ['movie', 'show', 'watch', 'game', 'music', 'song', 'play', 'party', 'concert', 'series'],
        'Family & Friends': ['mom', 'dad', 'family', 'parent', 'friend', 'sister', 'brother', 'cousin', 'uncle', 'aunt'],
        'Love & Romance': ['love', 'miss', 'kiss', 'hug', 'baby', 'sweetheart', 'darling', '❤', 'babe', 'honey'],
        'Daily Life': ['home', 'sleep', 'tired', 'busy', 'day', 'morning', 'night', 'wake', 'bed'],
        'Health & Fitness': ['gym', 'workout', 'exercise', 'health', 'doctor', 'sick', 'medicine', 'run', 'yoga'],
        'Money & Shopping': ['buy', 'shopping', 'money', 'price', 'expensive', 'cheap', 'store', 'order', 'pay']
    }
    
    topic_counts = defaultdict(int)
    total = len(messages)
    
    for msg in messages:
        content_lower = msg['content'].lower()
        for topic, keywords in topic_keywords.items():
            if any(kw in content_lower for kw in keywords):
                topic_counts[topic] += 1
    
    topics = [
        {'name': topic, 'count': count, 'percentage': round((count / total) * 100, 1)}
        for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)
    ]
    
    return topics

def detect_love_languages(messages, person1, person2):
    """Enhanced love language detection"""
    love_language_keywords = {
        'words_of_affirmation': ['love you', 'proud', 'appreciate', 'thank you', 'amazing', 'best', 'beautiful', 'handsome', 'wonderful', 'smart', 'talented'],
        'quality_time': ['together', 'spend time', 'hang out', 'date', 'see you', 'visit', 'with you', 'call', 'video call', 'facetime'],
        'acts_of_service': ['help', 'do for you', 'made', 'cooked', 'clean', 'fix', 'take care', 'handle', 'done', 'prepared'],
        'gifts': ['gift', 'bought', 'present', 'surprise', 'got you', '🎁', 'order', 'send', 'flowers'],
        'physical_touch': ['hug', 'kiss', 'cuddle', 'hold', 'touch', 'embrace', '💋', '🤗', 'hold hands', 'massage']
    }
    
    results = []
    
    for person in [person1, person2]:
        person_messages = [m for m in messages if m['sender'] == person]
        
        for lang_type, keywords in love_language_keywords.items():
            count = sum(1 for msg in person_messages 
                       if any(kw in msg['content'].lower() for kw in keywords))
            
            if count > 0:
                results.append({
                    'person': person,
                    'language_type': lang_type,
                    'language_display': lang_type.replace('_', ' ').title(),
                    'count': count
                })
    
    return results

# OPTIMIZED: Smart sampling for Gemini insights
def generate_relationship_insights(messages, person1, person2, conv_id):
    """Generate insights using STRATEGIC sampling"""
    # Check cache first
    cache_key = f"insights_{conv_id}"
    if cache_key in gemini_cache:
        return gemini_cache[cache_key]
    
    try:
        # SMART SAMPLING: Get diverse message samples
        total_msgs = len(messages)
        
        # Take messages from different periods
        sample_size = min(30, total_msgs)  # Max 30 messages
        
        # Get beginning, middle, end samples
        beginning = messages[:10]
        middle_idx = total_msgs // 2
        middle = messages[middle_idx:middle_idx+10]
        end = messages[-10:]
        
        sampled = beginning + middle + end
        sampled = sampled[:sample_size]  # Limit to 30
        
        # Include only positive and negative extremes
        sampled = [m for m in sampled if m.get('sentiment') in ['love', 'positive', 'negative']][:20]
        
        context = "\n".join([f"{m['sender']}: {m['content'][:60]}" for m in sampled])
        
        prompt = f"""Based on {total_msgs} messages between {person1} and {person2}, here's a sample:

{context}

Provide brief insights (under 150 words):
1. Communication style (2 sentences)
2. Relationship strength (2 sentences)  
3. Growth suggestion (1 sentence)"""

        response = gemini_model.generate_content(prompt)
        result = response.text
        
        # Cache it
        gemini_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"Gemini error: {e}")
        return f"Analyzed {len(messages)} messages between {person1} and {person2}. Your conversations show a mix of emotions and topics, reflecting a dynamic relationship."

def generate_monthly_summaries(messages):
    """Enhanced monthly summaries WITHOUT Gemini (too expensive)"""
    if not messages:
        return []
    
    monthly_groups = defaultdict(list)
    for msg in messages:
        month_key = msg['timestamp'].strftime('%Y-%m')
        monthly_groups[month_key].append(msg)
    
    summaries = []
    
    for month, msgs in sorted(monthly_groups.items()):
        happy_moments = [
            {'sender': m['sender'], 'content': m['content'][:100], 'timestamp': m['timestamp'].isoformat()}
            for m in msgs 
            if m.get('sentiment') in ['positive', 'love', 'happy', 'cute']
        ]
        happy_moments.sort(key=lambda x: x['timestamp'], reverse=True)
        
        positive_count = sum(1 for m in msgs if m.get('sentiment') in ['positive', 'love', 'happy'])
        negative_count = sum(1 for m in msgs if m.get('sentiment') == 'negative')
        love_count = sum(1 for m in msgs if m.get('sentiment') == 'love')
        
        summary_text = f"This month had {len(msgs)} messages. "
        if love_count > 10:
            summary_text += f"Lots of love with {love_count} affectionate moments! 💕 "
        if positive_count > negative_count * 2:
            summary_text += f"Mostly positive vibes! 😊"
        elif negative_count > positive_count:
            summary_text += f"Some challenges, but you're working through them together. 💪"
        else:
            summary_text += f"A balanced mix of emotions. 🌈"
        
        summaries.append({
            'period': datetime.strptime(month, '%Y-%m').strftime('%B %Y'),
            'summary_text': summary_text,
            'happy_moments': happy_moments[:5],
            'message_count': len(msgs),
            'sentiment_breakdown': {
                'positive': positive_count,
                'negative': negative_count,
                'love': love_count
            }
        })
    
    return summaries

# API Endpoints
@app.get("/")
def root():
    return {"message": "Relationship Insights API - Optimized with Smart Gemini Usage"}

@app.get("/api/conversations/")
def get_conversations():
    return [
        {
            'id': conv_id,
            'title': conv['title'],
            'person1_name': conv['person1_name'],
            'person2_name': conv['person2_name'],
            'message_count': len(conv['messages'])
        }
        for conv_id, conv in conversations_db.items()
    ]

@app.post("/api/conversations/upload_chat/")
def upload_chat(data: ChatUpload):
    global conversation_counter
    
    try:
        messages = parse_chat_text(data.chat_text)
        
        if len(messages) < 2:
            raise HTTPException(status_code=400, detail="Could not parse messages. Please check format.")
        
        senders = list(set(msg['sender'] for msg in messages))
        if len(senders) < 2:
            senders.append("Person 2")
        
        conversation_counter += 1
        conv_id = conversation_counter
        
        conversations_db[conv_id] = {
            'id': conv_id,
            'title': data.title,
            'person1_name': senders[0],
            'person2_name': senders[1],
            'messages': messages
        }
        
        return {'conversation_id': conv_id, 'message_count': len(messages)}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/conversations/{conv_id}/analyze/")
# REPLACE this in analyze_conversation() function:
# REPLACE this in analyze_conversation() function:
def analyze_conversation(conv_id: int):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations_db[conv_id]
    messages = conv['messages']
    
    # OLD WAY (SLOW):
    # for msg in messages:
    #     sentiment, score = detect_sentiment(msg['content'])
    
    # NEW WAY (FAST) - Batch processing:
    batch_size = 32
    for i in range(0, len(messages), batch_size):
        batch = messages[i:i+batch_size]
        texts = [msg['content'][:512] for msg in batch]
        
        # Process batch at once
        results = sentiment_analyzer(texts)
        
        for msg, result in zip(batch, results):
            sentiment_map = {'POSITIVE': 'positive', 'NEGATIVE': 'negative'}
            sentiment = sentiment_map.get(result['label'], 'neutral')
            score = result['score']
            
            # Apply emotion detection
            text_lower = msg['content'].lower()
            if any(word in text_lower for word in ['love', '❤', '😍', '💕']):
                sentiment = 'love'
            
            msg['sentiment'] = sentiment
            msg['score'] = score
    
    return {'status': 'analyzed', 'messages_processed': len(messages)}

@app.get("/api/conversations/{conv_id}/dashboard_data/")
def get_dashboard_data(conv_id: int):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations_db[conv_id]
    messages = conv['messages']
    
    if not messages[0].get('sentiment'):
        for msg in messages:
            sentiment, score = detect_sentiment(msg['content'])
            msg['sentiment'] = sentiment
            msg['score'] = score
    
    sentiment_timeline = [
        {
            'timestamp': msg['timestamp'].isoformat(),
            'sentiment': msg['sentiment'],
            'score': msg['score']
        }
        for msg in messages
    ]
    
    fights = detect_fights(messages)
    topics = detect_topics(messages)
    love_languages = detect_love_languages(messages, conv['person1_name'], conv['person2_name'])
    summaries = generate_monthly_summaries(messages)
    
    # Only call Gemini ONCE for overall insights
    relationship_insights = generate_relationship_insights(
        messages, 
        conv['person1_name'], 
        conv['person2_name'],
        conv_id
    )
    
    return {
        'conversation': {
            'id': conv_id,
            'title': conv['title'],
            'person1_name': conv['person1_name'],
            'person2_name': conv['person2_name']
        },
        'total_messages': len(messages),
        'sentiment_timeline': sentiment_timeline,
        'fights': fights,
        'topics': topics,
        'love_languages': love_languages,
        'summaries': summaries,
        'relationship_insights': relationship_insights
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)