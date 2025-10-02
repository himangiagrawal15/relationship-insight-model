import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Heart, MessageCircle, TrendingUp, AlertTriangle, Calendar, Upload, Sparkles, Brain, Smile, Frown } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-red-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold text-white mb-4 flex items-center justify-center gap-4">
              <Heart className="text-pink-300" size={60} />
              Relationship Insights
            </h1>
            <p className="text-pink-100 text-xl">Discover the story of your relationship through AI</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Upload size={28} />
              Upload Your Chat History
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
                      className="w-full text-left p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white"
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-red-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2 flex items-center justify-center gap-4">
            <Heart className="text-pink-300" size={48} />
            {conversation.person1_name} & {conversation.person2_name}
          </h1>
          <p className="text-pink-100 text-lg">{conversation.title}</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all"
          >
            Upload New Chat
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
          <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Brain size={28} className="text-purple-300" />
              AI-Powered Relationship Insights
            </h2>
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-white text-lg leading-relaxed whitespace-pre-line">
                {relationship_insights}
              </p>
            </div>
          </div>
        )}

        {/* Sentiment Timeline */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <TrendingUp size={28} />
            Emotional Journey
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
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Smile size={28} />
              Emotional Breakdown
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
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">What You Talk About</h2>
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
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Heart size={28} className="text-pink-400" />
            Love Languages Analysis ❤️
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

        {/* Fights */}
        {fights.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <AlertTriangle size={28} className="text-red-400" />
              Conflict Analysis
            </h2>
            <div className="space-y-4">
              {fights.map((fight, idx) => (
                <div key={idx} className="bg-red-500/20 border border-red-400/30 rounded-xl p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-white font-semibold">
                      {new Date(fight.start_time).toLocaleDateString()}
                    </div>
                    <div className="flex gap-1">
                      {[...Array(fight.severity)].map((_, i) => (
                        <span key={i} className="text-red-400">🔥</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-pink-100 mb-2">
                    <strong>Trigger:</strong> {fight.trigger_phrase}
                  </p>
                  <p className="text-white text-sm bg-white/10 p-4 rounded-lg">{fight.ai_summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Summaries */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Sparkles size={28} />
            Relationship Timeline
          </h2>
          <div className="space-y-6">
            {summaries.map((summary, idx) => (
              <div key={idx} className="bg-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-3">{summary.period}</h3>
                <p className="text-pink-100 mb-4">{summary.summary_text}</p>
                {summary.happy_moments && summary.happy_moments.length > 0 && (
                  <div>
                    <h4 className="text-white font-semibold mb-2">💖 Happy Moments:</h4>
                    <ul className="space-y-2">
                      {summary.happy_moments.slice(0, 3).map((moment, i) => (
                        <li key={i} className="text-sm text-pink-200 bg-white/5 p-3 rounded-lg">
                          <strong>{moment.sender}:</strong> {moment.content}...
                        </li>
                      ))}
                    </ul>
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
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-6 shadow-xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-white opacity-80">{icon}</div>
        <div className="text-3xl font-bold text-white">{value}</div>
      </div>
      <div className="text-white text-sm font-medium">{label}</div>
    </div>
  );
};

export default Dashboard;