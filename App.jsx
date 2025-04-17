import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { motion } from "framer-motion";

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyDf2Bh7wxMOSNaYajgzZnCrh2_bF_lSryI",
  authDomain: "pr-qr-st-nv.firebaseapp.com",
  projectId: "pr-qr-st-nv",
  storageBucket: "pr-qr-st-nv.firebasestorage.app",
  messagingSenderId: "548501365786",
  appId: "1:548501365786:web:fc6b89badcaf8b61379da3",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Voice-to-text setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function SurveyApp() {
  const [mode, setMode] = useState(null); // 'Parent' or 'Student'
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [respondentsCount, setRespondentsCount] = useState(0);
  const [questions, setQuestions] = useState([]);

  // Build question sets
  const demographicQs = [
    { id: 'age', text: 'What is your age?', type: 'dropdown', options: Array.from({ length: 15 }, (_, i) => (16 + i).toString()) },
    { id: 'city', text: 'Which city was the interview taken in?', type: 'text' },
    { id: 'state', text: 'Which state do you belong to?', type: 'dropdown', options: [
      'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'
    ] }
  ];

  // Load mode-specific questions from uploaded docs
  const parentQs = [
    // sample branching from Parents-q1.docx
    { id: 'use_social', text: 'Do you use any social media platforms?', type: 'yesno' },
    { id: 'list_platforms', text: 'Which platforms are you most active on?', type: 'multi', options: ['Facebook','YouTube','Instagram','WhatsApp','Pinterest'] , condition: r=>r.use_social==='Yes'},
    // ...continue mapping parents questions
  ];

  const studentQs = [
    // sample branching from Students-q1.docx
    { id: 'relax_app', text: 'When you want to relax or be entertained, do you open any app?', type: 'yesno' },
    { id: 'which_app', text: 'Which app do you open first?', type: 'multi', options: ['Instagram','YouTube','X','Snapchat','Facebook','Pinterest','LinkedIn'], condition: r=>r.relax_app==='Yes'},
    // ...continue mapping students questions
  ];

  // Initialize questions when mode selected
  useEffect(() => {
    if (mode) {
      setQuestions([...demographicQs, ...(mode==='Parent'? parentQs : studentQs)]);
    }
  }, [mode]);

  const currentQ = questions[stepIndex];

  // Save to Firestore
  const saveResponse = async (data) => {
    try {
      await addDoc(collection(db, mode==='Parent'? 'parent_responses':'student_responses'), data);
    } catch (e) {
      console.error('Error saving response:', e);
    }
  };

  // Handle answer
  const handleAnswer = (id, value) => {
    const updated = { ...responses, [id]: value, mode };
    setResponses(updated);
    let nextIndex = questions.findIndex((q,i)=> i>stepIndex && (!q.condition || q.condition(updated)));
    if (nextIndex !== -1) setStepIndex(nextIndex);
    else {
      saveResponse(updated);
      setResponses({}); setStepIndex(0); setMode(null);
      setRespondentsCount(c=>c+1);
    }
  };

  // Voice input hook
  const startVoice = (id) => {
    if (!SpeechRecognition) return;
    const recog = new SpeechRecognition();
    recog.onresult = event => {
      const text = event.results[0][0].transcript;
      handleAnswer(id,text);
    };
    recog.start();
  };

  // Mode selection
  if (!mode) return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl mb-4">Choose respondent mode:</h2>
      <div className="space-x-4">
        <Button onClick={()=>setMode('Parent')}>Parent</Button>
        <Button onClick={()=>setMode('Student')}>Student</Button>
      </div>
    </div>
  );

  // Questionnaire UI
  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <div className="absolute top-4 right-6 font-semibold">Respondents: {respondentsCount}</div>
      <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} className="w-full max-w-xl">
        <Card className="bg-white text-black rounded-2xl shadow-md">
          <CardContent className="p-6">
            <div className="text-xl font-semibold mb-4">{currentQ.text}</div>
            {currentQ.type==='dropdown' && (
              <select className="w-full p-2 rounded" onChange={e=>handleAnswer(currentQ.id,e.target.value)}>
                <option value="">-- Select --</option>
                {currentQ.options.map(opt=><option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {currentQ.type==='yesno' && (
              <div className="flex space-x-4">
                <Button onClick={()=>handleAnswer(currentQ.id,'Yes')}>Yes</Button>
                <Button onClick={()=>handleAnswer(currentQ.id,'No')}>No</Button>
              </div>
            )}
            {currentQ.type==='multi' && (
              <div className="space-y-2">
                {currentQ.options.map(opt=>(
                  <label key={opt} className="inline-flex items-center">
                    <Checkbox onCheckedChange={val=>{
                      const prev = responses[currentQ.id]||[];
                      const updated = val? [...prev,opt]: prev.filter(i=>i!==opt);
                      setResponses({...responses,[currentQ.id]:updated});
                    }}/>
                    <span className="ml-2">{opt}</span>
                  </label>
                ))}
                <Button onClick={()=>handleAnswer(currentQ.id,responses[currentQ.id]||[])}>Next</Button>
              </div>
            )}
            {currentQ.type==='text' && (
              <div className="flex space-x-2">
                <Input className="flex-grow" onBlur={e=>handleAnswer(currentQ.id,e.target.value)} placeholder="Type your response..."/>
                <Button onClick={()=>startVoice(currentQ.id)}>🎤</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}