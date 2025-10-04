import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Heart, MessageCircle, TrendingUp, AlertTriangle, Calendar, Upload, Sparkles, Brain, Smile, Frown } from 'lucide-react';

const API_BASE= 'https://hehehimi-relationship-insights.hf.space/api';
// Cute floating character animation component
const FloatingCharacter = () => {
  return (
    <div className="fixed bottom-8 right-8 pointer-events-none z-50 animate-float">
      <div className="relative w-32 h-32">
        {/* Character body */}
        <svg viewBox="0 0 200 200" className="w-full h-full animate-bounce-slow">
          {/* Back spikes */}
          <ellipse cx="100" cy="90" rx="25" ry="35" fill="#FF9DAF" transform="rotate(-20 100 90)"/>
          <ellipse cx="110" cy="70" rx="25" ry="35" fill="#FF9DAF" transform="rotate(-10 110 70)"/>
          <ellipse cx="120" cy="55" rx="25" ry="35" fill="#FF9DAF"/>
          <ellipse cx="130" cy="70" rx="25" ry="35" fill="#FF9DAF" transform="rotate(10 130 70)"/>
          
          {/* Dino body */}
          <ellipse cx="100" cy="120" rx="65" ry="55" fill="#7DD3C0"/>
          
          {/* Dino head */}
          <ellipse cx="80" cy="85" rx="45" ry="40" fill="#7DD3C0"/>
          
          {/* Snout */}
          <ellipse cx="50" cy="90" rx="25" ry="20" fill="#6BC4B0"/>
          
          {/* White belly on head */}
          <ellipse cx="85" cy="95" rx="30" ry="25" fill="white"/>
          
          {/* Eyes */}
          <circle cx="70" cy="80" r="4" fill="#2C3E50" className="animate-blink"/>
          <circle cx="90" cy="80" r="4" fill="#2C3E50" className="animate-blink"/>
          
          {/* Eye sparkles */}
          <circle cx="72" cy="78" r="1.5" fill="white"/>
          <circle cx="92" cy="78" r="1.5" fill="white"/>
          
          {/* Cute blush */}
          <ellipse cx="60" cy="95" rx="8" ry="5" fill="#FFB6C1" opacity="0.6"/>
          <ellipse cx="95" cy="95" rx="8" ry="5" fill="#FFB6C1" opacity="0.6"/>
          
          {/* Smile */}
          <path d="M 65 100 Q 75 108 85 100" stroke="#2C3E50" strokeWidth="2" fill="none" strokeLinecap="round"/>
          
          {/* Cute teeth */}
          <rect x="48" y="105" width="6" height="8" fill="white" rx="1"/>
          <rect x="56" y="105" width="6" height="8" fill="white" rx="1"/>
          <rect x="64" y="105" width="6" height="8" fill="white" rx="1"/>
          
          {/* Arms */}
          <ellipse cx="65" cy="125" rx="15" ry="25" fill="#7DD3C0"/>
          <ellipse cx="135" cy="125" rx="15" ry="25" fill="#7DD3C0"/>
          
          {/* Paws */}
          <ellipse cx="65" cy="145" rx="12" ry="8" fill="#6BC4B0"/>
          <ellipse cx="135" cy="145" rx="12" ry="8" fill="#6BC4B0"/>
          
          {/* Tail */}
          <ellipse cx="145" cy="130" rx="20" ry="30" fill="#7DD3C0" transform="rotate(30 145 130)"/>
          <circle cx="158" cy="140" r="8" fill="#7DD3C0"/>
        </svg>
        
        {/* Floating hearts around character */}
        <Heart className="absolute -top-2 -right-2 text-pink-400 animate-ping" size={16} />
        <Heart className="absolute -bottom-2 -left-2 text-red-400 animate-pulse" size={12} />
      </div>
    </div>
  );
};

// Floating hearts animation component
const FloatingHearts = () => {
  const hearts = [
    { delay: '0s', duration: '4s', left: '10%' },
    { delay: '1s', duration: '5s', left: '25%' },
    { delay: '2s', duration: '4.5s', left: '50%' },
    { delay: '0.5s', duration: '5.5s', left: '75%' },
    { delay: '1.5s', duration: '4s', left: '90%' }
  ];

  return (
    <>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {hearts.map((heart, i) => (
          <Heart
            key={i}
            className="absolute text-pink-300/20"
            style={{
              left: heart.left,
              animation: `float-up ${heart.duration} ${heart.delay} infinite ease-in-out`,
              bottom: '-50px'
            }}
            size={30}
          />
        ))}
      </div>
      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        @keyframes bounce-slow {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        @keyframes blink {
          0%, 90%, 100% {
            opacity: 1;
          }
          95% {
            opacity: 0;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        .animate-blink {
          animation: blink 4s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};
// Floating hearts animation component


const Dashboard = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [showUpload, setShowUpload] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations/`);
      const data = await res.json();
      setConversations(data);
      if (data.length > 0 && !selectedConv) {
        selectConversation(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const selectConversation = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}/dashboard_data/`);
      const data = await res.json();
      setDashboardData(data);
      setSelectedConv(id);
      setShowUpload(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!uploadText.trim()) return;
    
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/conversations/upload_chat/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_text: uploadText, title: 'My Conversation' })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            // Start analysis
            await fetch(`${API_BASE}/conversations/${data.conversation_id}/analyze/`, {
                method: 'POST'
            });
            
            // ADD: Poll for progress
            let complete = false;
            while (!complete) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec
                
                const statusRes = await fetch(`${API_BASE}/conversations/${data.conversation_id}/analysis_status/`);
                const status = await statusRes.json();
                
                console.log(`Progress: ${status.progress}%`);
                // TODO: Show progress bar with status.progress
                
                if (status.status === 'complete') {
                    complete = true;
                }
            }
            
            await fetchConversations();
            await selectConversation(data.conversation_id);
            setUploadText('');
        }
    } catch (err) {
        alert('Upload failed: ' + err.message);
    }
    setLoading(false);
};

  if (showUpload || !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-red-800 p-8 relative overflow-hidden">
        <FloatingHearts />
        <FloatingCharacter />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold text-white mb-4 flex items-center justify-center gap-4 animate-pulse">
              <Heart className="text-pink-300 animate-bounce" size={60} />
              Happy Boyfriends Day lover boy
              <Heart className="text-pink-300 animate-bounce" style={{ animationDelay: '0.5s' }} size={60} />
            </h1>
            <p className="text-pink-100 text-xl animate-fade-in">Discover the story of your relationship through AI ✨</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 transform hover:scale-105 transition-all duration-300">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Upload size={28} className="animate-bounce" />
              Upload Your Chat History 💕
            </h2>
            
            <div className="mb-6">
              <label className="block text-pink-100 mb-3 text-sm">
                Paste your WhatsApp/Telegram chat export below:
              </label>
              <textarea
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                placeholder="1/15/24, 2:30 PM - Alice: Hey! How are you?&#10;1/15/24, 2:31 PM - Bob: I'm good! Miss you ❤️"
                className="w-full h-64 p-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={loading || !uploadText.trim()}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 transition-all transform hover:scale-105 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>Processing... <Sparkles className="animate-spin" /></>
              ) : (
                <>Analyze Relationship <Heart /></>
              )}
            </button>

            {conversations.length > 0 && (
              <div className="mt-8 pt-8 border-t border-white/20">
                <h3 className="text-white font-semibold mb-4">Previous Conversations:</h3>
                <div className="space-y-2">
                  {conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className="w-full text-left p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white transform hover:scale-105"
                    >
                      <div className="font-semibold">{conv.title}</div>
                      <div className="text-sm text-pink-200">
                        {conv.person1_name} & {conv.person2_name} • {conv.message_count} messages
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { conversation, sentiment_timeline, fights, topics, love_languages, summaries, relationship_insights } = dashboardData;

  // Process sentiment data
  const sentimentData = sentiment_timeline.reduce((acc, msg, idx) => {
    if (idx % Math.ceil(sentiment_timeline.length / 50) === 0) {
      const date = new Date(msg.timestamp).toLocaleDateString();
      const score = msg.sentiment === 'positive' ? msg.score : -msg.score;
      acc.push({ date, score, sentiment: msg.sentiment });
    }
    return acc;
  }, []);

  // Sentiment distribution
  const sentimentCounts = sentiment_timeline.reduce((acc, msg) => {
    acc[msg.sentiment] = (acc[msg.sentiment] || 0) + 1;
    return acc;
  }, {});
  
  const sentimentPieData = Object.entries(sentimentCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  // Love language radar data
  const radarData = {};
  love_languages.forEach(ll => {
    if (!radarData[ll.language_type]) {
      radarData[ll.language_type] = { language: ll.language_display, [ll.person]: ll.count };
    } else {
      radarData[ll.language_type][ll.person] = ll.count;
    }
  });
  const radarArray = Object.values(radarData);

  // Topic pie data
  const topicPieData = topics.slice(0, 5).map(t => ({ name: t.name, value: t.percentage }));
  const COLORS = ['#FF6B9D', '#C44569', '#F8B500', '#8E44AD', '#3498DB'];
  const SENTIMENT_COLORS = {
    'Positive': '#4CAF50',
    'Love': '#FF6B9D',
    'Happy': '#FFC107',
    'Cute': '#FF69B4',
    'Negative': '#F44336',
    'Sad': '#2196F3',
    'Neutral': '#9E9E9E'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-red-800 p-8 relative overflow-hidden">
      <FloatingHearts />
      <FloatingCharacter />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-bold text-white mb-2 flex items-center justify-center gap-4">
            <Heart className="text-pink-300 animate-pulse" size={48} />
            {conversation.person1_name} & {conversation.person2_name}
            <Heart className="text-pink-300 animate-pulse" style={{ animationDelay: '1s' }} size={48} />
          </h1>
          <p className="text-pink-100 text-lg">{conversation.title} 💖</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all transform hover:scale-110"
          >
            Upload New Chat ✨
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<MessageCircle />}
            label="Total Messages"
            value={dashboardData.total_messages.toLocaleString()}
            color="pink"
          />
          <StatCard
            icon={<TrendingUp />}
            label="Topics Discussed"
            value={topics.length}
            color="purple"
          />
          <StatCard
            icon={<AlertTriangle />}
            label="Conflicts"
            value={fights.length}
            color="red"
          />
          <StatCard
            icon={<Calendar />}
            label="Months Analyzed"
            value={summaries.length}
            color="blue"
          />
        </div>

        {/* AI Insights - NEW! */}
        {relationship_insights && (
          <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20 transform hover:scale-105 transition-all duration-300">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Brain size={28} className="text-purple-300 animate-pulse" />
              AI-Powered Relationship Insights ✨
            </h2>
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-white text-lg leading-relaxed whitespace-pre-line">
                {relationship_insights}
              </p>
            </div>
          </div>
        )}

        {/* Sentiment Timeline */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20 transform hover:scale-105 transition-all duration-300">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <TrendingUp size={28} className="animate-bounce" />
            Emotional Journey 💕
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sentimentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '10px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="score" stroke="#FF6B9D" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Sentiment Distribution - NEW! */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 transform hover:scale-105 transition-all duration-300">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Smile size={28} className="animate-bounce" />
              Emotional Breakdown 😊
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sentimentPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sentimentPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Topics */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 transform hover:scale-105 transition-all duration-300">
            <h2 className="text-2xl font-bold text-white mb-6">What You Talk About 💬</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topicPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {topicPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Love Languages */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20 transform hover:scale-105 transition-all duration-300">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Heart size={28} className="text-pink-400 animate-pulse" />
            Love Languages Analysis ❤️💕
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarArray}>
              <PolarGrid stroke="#fff" />
              <PolarAngleAxis dataKey="language" stroke="#fff" />
              <PolarRadiusAxis stroke="#fff" />
              <Radar name={conversation.person1_name} dataKey={conversation.person1_name} stroke="#FF6B9D" fill="#FF6B9D" fillOpacity={0.6} />
              <Radar name={conversation.person2_name} dataKey={conversation.person2_name} stroke="#8E44AD" fill="#8E44AD" fillOpacity={0.6} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        
       {/* Monthly Summaries */}
<div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 transform hover:scale-105 transition-all duration-300">
  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
    <Calendar size={28} className="animate-bounce" />
    Monthly Relationship Journey 📅✨
  </h2>
  <div className="space-y-8">
    {summaries.map((summary, idx) => (
      <div key={idx} className="bg-white/10 rounded-2xl p-6 border border-white/20">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-white">{summary.period}</h3>
          <div className="text-pink-200 text-sm">
            {summary.message_count} messages
          </div>
        </div>

       {/* AI Summary */}
        <div className="bg-purple-500/20 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-purple-300 mt-1 flex-shrink-0" />
            <div className="text-white leading-relaxed w-full">
              {summary.ai_summary.split('\n').map((paragraph, i) => {
                if (!paragraph.trim()) return null;
                
                // Handle numbered lists (1. 2. 3.) in separate boxes
                const numberedMatch = paragraph.trim().match(/^(\d+)\.\s*\*\*([^*]+)\*\*:?\s*(.*)/);
                if (numberedMatch) {
                  const [, number, title, content] = numberedMatch;
                  const colors = [
                    'bg-gradient-to-r from-pink-500/30 to-purple-500/30 border-pink-400/40',
                    'bg-gradient-to-r from-blue-500/30 to-indigo-500/30 border-blue-400/40',
                    'bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-green-400/40',
                    'bg-gradient-to-r from-orange-500/30 to-red-500/30 border-orange-400/40'
                  ];
                  const colorClass = colors[(parseInt(number) - 1) % colors.length];
                  
                  return (
                    <div key={i} className={`${colorClass} border rounded-xl p-4 mb-3 transform hover:scale-105 transition-all duration-300`}>
                      <div className="flex items-start gap-3">
                        <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">{number}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-bold text-lg mb-2">{title}</h4>
                          <p className="text-white/90 text-sm leading-relaxed">{content}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Handle regular numbered items without bold title
                if (/^\d+\./.test(paragraph.trim())) {
                  const number = paragraph.match(/^\d+\./)[0];
                  const content = paragraph.replace(/^\d+\.\s*/, '');
                  const colors = [
                    'bg-gradient-to-r from-pink-500/30 to-purple-500/30 border-pink-400/40',
                    'bg-gradient-to-r from-blue-500/30 to-indigo-500/30 border-blue-400/40',
                    'bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-green-400/40',
                    'bg-gradient-to-r from-orange-500/30 to-red-500/30 border-orange-400/40'
                  ];
                  const colorClass = colors[(parseInt(number) - 1) % colors.length];
                  
                  return (
                    <div key={i} className={`${colorClass} border rounded-xl p-4 mb-3 transform hover:scale-105 transition-all duration-300`}>
                      <div className="flex items-start gap-3">
                        <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">{number.replace('.', '')}</span>
                        </div>
                        <p className="text-white/90 text-sm leading-relaxed flex-1">{content}</p>
                      </div>
                    </div>
                  );
                }
                
                // Handle bold text with **text** or ***text***
                let formattedText = paragraph;
                
                // Replace ***text*** with bold
                formattedText = formattedText.split(/(\*\*\*[^*]+\*\*\*)/).map((part, idx) => {
                  if ((part.startsWith('***') && part.endsWith('***'))) {
                    return <strong key={idx} className="text-pink-300 font-bold">{part.slice(3, -3)}</strong>;
                  }
                  return part;
                });
                
                // Replace **text** with bold
                formattedText = formattedText.flat().map((part, idx) => {
                  if (typeof part === 'string') {
                    return part.split(/(\*\*[^*]+\*\*)/).map((subpart, subidx) => {
                      if (subpart.startsWith('**') && subpart.endsWith('**')) {
                        return <strong key={`${idx}-${subidx}`} className="text-purple-200 font-semibold">{subpart.slice(2, -2)}</strong>;
                      }
                      return subpart;
                    });
                  }
                  return part;
                }).flat();
                
                return <p key={i} className="mb-3 text-sm">{formattedText}</p>;
              })}
            </div>
          </div>
        </div>
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-green-500/20 rounded-lg p-3 text-center transform hover:scale-110 transition-all duration-300">
            <div className="text-2xl font-bold text-green-300">
              {summary.sentiment_stats.positive}
            </div>
            <div className="text-xs text-green-200">Happy</div>
          </div>
          <div className="bg-pink-500/20 rounded-lg p-3 text-center transform hover:scale-110 transition-all duration-300">
            <div className="text-2xl font-bold text-pink-300">
              {summary.sentiment_stats.love}
            </div>
            <div className="text-xs text-pink-200">Love</div>
          </div>
          <div className="bg-red-500/20 rounded-lg p-3 text-center transform hover:scale-110 transition-all duration-300">
            <div className="text-2xl font-bold text-red-300">
              {summary.fights?.length || 0}
            </div>
            <div className="text-xs text-red-200">Conflicts</div>
          </div>
        </div>

        {/* Cute Moments */}
        {summary.cute_moments && summary.cute_moments.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Heart size={18} className="text-pink-400 animate-pulse" />
              Cute Moments 💕
            </h4>
            <div className="space-y-2">
              {summary.cute_moments.map((moment, i) => (
                <div key={i} className="bg-pink-500/10 border border-pink-400/20 rounded-lg p-3 transform hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/30">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-pink-300 font-semibold text-sm">
                      {moment.sender} 💖
                    </span>
                    <span className="text-pink-200 text-xs">{moment.date}</span>
                  </div>
                  <p className="text-white text-sm">{moment.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fights */}
        {summary.fights && summary.fights.length > 0 && (
          <div>
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              Conflicts This Month
            </h4>
            <div className="space-y-2">
              {summary.fights.map((fight, i) => (
                <div key={i} className="bg-red-500/10 border border-red-400/20 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-red-300 text-xs">{fight.date}</span>
                    <div className="flex gap-1">
                      {[...Array(fight.severity)].map((_, idx) => (
                        <span key={idx} className="text-red-400 text-xs">🔥</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-white text-sm">{fight.trigger}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
</div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    pink: 'from-pink-500 to-pink-600',
    purple: 'from-purple-500 to-purple-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600'
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-6 shadow-xl transform hover:scale-110 hover:rotate-2 transition-all duration-300 cursor-pointer`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-white opacity-80 animate-bounce">{icon}</div>
        <div className="text-3xl font-bold text-white animate-pulse">{value}</div>
      </div>
      <div className="text-white text-sm font-medium">{label}</div>
    </div>
  );
};

export default Dashboard;
