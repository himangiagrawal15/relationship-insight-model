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
gemini_model = genai.GenerativeModel('gemini-2.5-flash')

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
        r'(\d{1,2}/\d{1,2}/\d{2},\s+\d{1,2}:\d{2}\s+[AP]M)\s+-\s+([^:]+):\s*(.+)',
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
                    for fmt in ['%m/%d/%y, %I:%M %p', '%m/%d/%y, %I:%M %p', '%m/%d/%Y, %I:%M %p', '%d/%m/%y, %H:%M', 
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
from fastapi import File, UploadFile
import pandas as pd
import io

@app.post("/api/conversations/upload_csv/")
async def upload_csv(file: UploadFile = File(...), title: str = "My Conversation"):
    try:
        # Read CSV file
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Expected columns: timestamp, sender, message
        # Adjust column names based on your CSV format
        required_cols = ['timestamp', 'sender', 'message']
        
        if not all(col in df.columns for col in required_cols):
            raise HTTPException(
                status_code=400, 
                detail=f"CSV must contain columns: {required_cols}"
            )
        
        # Convert to messages format
        messages = []
        for _, row in df.iterrows():
            try:
                timestamp = pd.to_datetime(row['timestamp'])
                messages.append({
                    'timestamp': timestamp,
                    'sender': str(row['sender']).strip(),
                    'content': str(row['message']).strip()
                })
            except Exception as e:
                continue  # Skip malformed rows
        
        if len(messages) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 valid messages")
        
        # Get unique senders
        senders = list(set(msg['sender'] for msg in messages))
        if len(senders) < 2:
            senders.append("Person 2")
        
        # Create conversation
        global conversation_counter
        conversation_counter += 1
        conv_id = conversation_counter
        
        conversations_db[conv_id] = {
            'id': conv_id,
            'title': title,
            'person1_name': senders[0],
            'person2_name': senders[1],
            'messages': messages
        }
        
        return {'conversation_id': conv_id, 'message_count': len(messages)}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
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
def analyze_fight_simple(fight_messages, negative_count):
    """Simple rule-based fight analysis - NO GEMINI"""
    if negative_count >= 4:
        return "Intense disagreement detected. Take time to cool down and revisit the conversation with empathy."
    elif negative_count >= 3:
        return "Moderate conflict. Try to understand each other's perspective and find common ground."
    else:
        return "Minor disagreement. Open communication can help clear misunderstandings."

def detect_fights(messages):
    """Enhanced fight detection - NO GEMINI"""
    fights = []
    
    fight_keywords = [
        'always', 'never', 'angry', 'upset', 'annoyed', 'frustrated', 
        'why do you', "you don't", 'tired of', 'enough', 'stop', 'serious',
        'whatever', 'fine', 'forget it', 'leave me alone'
    ]
    
    i = 0
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
                fights.append({
                    'start_time': msg['timestamp'].isoformat(),
                    'severity': min(negative_count, 5),
                    'trigger_phrase': msg['content'][:100],
                    'ai_summary': analyze_fight_simple(fight_messages, negative_count)  # Simple, no Gemini
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
    """Generate insights WITHOUT Gemini - simple stats-based"""
    total_msgs = len(messages)
    
    # Count sentiments
    positive = sum(1 for m in messages if m.get('sentiment') in ['positive', 'love', 'happy', 'cute'])
    negative = sum(1 for m in messages if m.get('sentiment') in ['negative', 'sad'])
    
    positive_pct = round((positive / total_msgs) * 100, 1)
    negative_pct = round((negative / total_msgs) * 100, 1)
    
    # Generate simple insight
    if positive_pct > 60:
        tone = "predominantly positive and affectionate"
        health = "Your relationship shows strong emotional connection."
    elif positive_pct > 40:
        tone = "balanced with both positive and challenging moments"
        health = "Your relationship has healthy ups and downs."
    else:
        tone = "facing some challenges"
        health = "Consider focusing on positive communication."
    
    return f"Analyzed {total_msgs} messages between {person1} and {person2}. Your conversations are {tone} ({positive_pct}% positive, {negative_pct}% negative). {health} The variety in your topics shows a well-rounded relationship."

def generate_monthly_summaries(messages, person1, person2):
    """Generate detailed monthly summaries with top conflicts and moments"""
    if not messages:
        return []
    
    # Group by month
    monthly_groups = defaultdict(list)
    for msg in messages:
        month_key = msg['timestamp'].strftime('%Y-%m')
        monthly_groups[month_key].append(msg)
    
    summaries = []
    
    for month_idx, (month, msgs) in enumerate(sorted(monthly_groups.items())):
        # Count stats
        positive_count = sum(1 for m in msgs if m.get('sentiment') in ['positive', 'happy'])
        negative_count = sum(1 for m in msgs if m.get('sentiment') in ['negative', 'sad'])
        love_count = sum(1 for m in msgs if m.get('sentiment') == 'love')
        cute_count = sum(1 for m in msgs if m.get('sentiment') == 'cute')
        
        # Extract top moments for display
        cute_moments = [
            m for m in msgs if m.get('sentiment') == 'cute' or
            any(word in m['content'].lower() for word in ['cute', 'adorable', 'aww'])
        ]
        cute_moments.sort(key=lambda x: x.get('score', 0), reverse=True)
        top_cute_display = [
            {
                'sender': m['sender'], 
                'content': m['content'][:150], 
                'timestamp': m['timestamp'].isoformat(),
                'date': m['timestamp'].strftime('%b %d')
            }
            for m in cute_moments[:3]
        ]
        
        love_moments = [
            m for m in msgs if m.get('sentiment') == 'love'
        ]
        love_moments.sort(key=lambda x: x.get('score', 0), reverse=True)
        top_love_display = [
            {
                'sender': m['sender'], 
                'content': m['content'][:150], 
                'timestamp': m['timestamp'].isoformat(),
                'date': m['timestamp'].strftime('%b %d')
            }
            for m in love_moments[:3]
        ]
        
        # Detect conflicts
        fight_count = sum(1 for m in msgs if m.get('sentiment') == 'negative' and m.get('score', 0) > 0.75)
        
        # SINGLE Gemini call per month for complete analysis
        ai_summary = generate_monthly_ai_summary(
            msgs, month, person1, person2, 
            positive_count, negative_count, love_count, 
            cute_count, fight_count
        )
        
        summaries.append({
            'period': datetime.strptime(month, '%Y-%m').strftime('%B %Y'),
            'message_count': len(msgs),
            'cute_moments': top_cute_display,
            'love_moments': top_love_display,
            'sentiment_stats': {
                'positive': positive_count,
                'negative': negative_count,
                'love': love_count,
                'cute': cute_count,
                'total': len(msgs)
            },
            'ai_summary': ai_summary  # Includes analysis of top 3 conflicts + top 3 cute + top 3 love
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
            if any(word in text_lower for word in ['love', '❤', '😍', '💕', 'pretty', 'mine', 'baby']):
                sentiment = 'love'
            
            msg['sentiment'] = sentiment
            msg['score'] = score
    
    return {'status': 'analyzed', 'messages_processed': len(messages)}
def generate_monthly_ai_summary(msgs, month, person1, person2, 
                               pos_count, neg_count, love_count, 
                               cute_count, fight_count):
    """Generate AI summary for top 3 conflicts + top 3 cute/love moments per month"""
    
    # Check cache
    cache_key = f"month_{month}_{len(msgs)}"
    if cache_key in gemini_cache:
        return gemini_cache[cache_key]
    
    try:
        # 1. Extract TOP 3 CONFLICTS
        conflict_messages = []
        fight_keywords = ['always', 'never', 'angry', 'upset', 'annoyed', 'frustrated', 
                         'why do you', "you don't", 'tired of', 'whatever', 'fine', 'stop']
        
        for msg in msgs:
            content_lower = msg['content'].lower()
            if (any(kw in content_lower for kw in fight_keywords) or 
                msg.get('sentiment') == 'negative' and msg.get('score', 0) > 0.75):
                conflict_messages.append(msg)
        
        # Take top 3 most negative conflicts
        conflict_messages.sort(key=lambda x: x.get('score', 0), reverse=True)
        top_conflicts = conflict_messages[:3]
        
        # 2. Extract TOP 3 CUTE MOMENTS
        cute_messages = [
            m for m in msgs 
            if m.get('sentiment') == 'cute' or 
            any(word in m['content'].lower() for word in ['cute', 'adorable', 'aww', 'sweet'])
        ]
        cute_messages.sort(key=lambda x: x.get('score', 0), reverse=True)
        top_cute = cute_messages[:3]
        
        # 3. Extract TOP 3 LOVE MOMENTS
        love_messages = [
            m for m in msgs 
            if m.get('sentiment') == 'love' or
            any(word in m['content'].lower() for word in ['love you', 'miss you', 'baby', 'darling'])
        ]
        love_messages.sort(key=lambda x: x.get('score', 0), reverse=True)
        top_love = love_messages[:3]
        
        # 4. Build context for Gemini
        conflict_context = "\n".join([
            f"[{m['timestamp'].strftime('%b %d')}] {m['sender']}: {m['content'][:120]}" 
            for m in top_conflicts
        ]) if top_conflicts else "No major conflicts this month"
        
        cute_context = "\n".join([
            f"[{m['timestamp'].strftime('%b %d')}] {m['sender']}: {m['content'][:120]}" 
            for m in top_cute
        ]) if top_cute else "No standout cute moments"
        
        love_context = "\n".join([
            f"[{m['timestamp'].strftime('%b %d')}] {m['sender']}: {m['content'][:120]}" 
            for m in top_love
        ]) if top_love else "No explicit love expressions"
        
        month_name = datetime.strptime(month, '%Y-%m').strftime('%B %Y')
        
        prompt = f"""Analyze {person1} and {person2}'s relationship in {month_name}:

**TOP 3 CONFLICTS:**
{conflict_context}

**TOP 3 CUTE MOMENTS:**
{cute_context}

**TOP 3 LOVE MOMENTS:**
{love_context}

Provide a warm, empathetic analysis with:
1. **Conflicts:** Briefly explain what caused each of the 3 conflicts and how to resolve them (2-3 sentences each)
2. **Cute Moments:** Highlight what made these 3 moments adorable (1-2 sentences each)
3. **Love Moments:** Explain the depth of affection shown in these 3 exchanges (1-2 sentences each)
4. **Monthly Vibe:** Overall emotional tone and relationship health (2-3 sentences)

Keep under 250 words, warm tone."""

        response = gemini_model.generate_content(prompt)
        result = response.text
        
        # Cache it
        gemini_cache[cache_key] = result
        return result
        
    except Exception as e:
        print(f"Gemini error for monthly summary: {e}")
        # Fallback
        return f"In {datetime.strptime(month, '%Y-%m').strftime('%B %Y')}, you exchanged {len(msgs)} messages with {pos_count} positive moments and {neg_count} challenging ones."
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
    summaries = generate_monthly_summaries(messages, conv['person1_name'], conv['person2_name'])
    
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