import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  image_url?: string;
}

interface Question {
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank';
  question_text: string;
  correct_answer: string;
  user_answer?: string;
  options?: string[];
  explanation?: string;
}

const TestMode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testStarted, setTestStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Pre-test settings
  const [questionCount, setQuestionCount] = useState(10);
  const [useAI, setUseAI] = useState(true);
  const [timeLimit, setTimeLimit] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['multiple_choice', 'true_false', 'fill_blank']);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  useEffect(() => {
    if (testStarted && timeLimit > 0 && timeRemaining !== null) {
      if (timeRemaining <= 0) {
        finishTest();
        return;
      }
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [testStarted, timeRemaining, timeLimit]);

  const fetchSetAndCards = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("title")
        .eq("id", id)
        .maybeSingle();

      if (setError) throw setError;
      if (!setData) {
        toast.error("Set not found");
        navigate("/");
        return;
      }
      
      setSetTitle(setData.title);

      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcards")
        .select("*")
        .eq("set_id", id)
        .order("position");

      if (cardsError) throw cardsError;
      if (cardsData.length === 0) {
        toast.error("This set has no flashcards");
        navigate("/");
        return;
      }

      setFlashcards(cardsData);
      setQuestionCount(Math.min(cardsData.length, 10));
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuestions = async () => {
    if (selectedTypes.length === 0) {
      toast.error("Please select at least one question type");
      return;
    }

    setIsGenerating(true);
    toast.loading("Making test...", { id: "generating-test" });

    const count = Math.min(questionCount, flashcards.length, 40);
    const selectedCards = flashcards.sort(() => Math.random() - 0.5).slice(0, count);

    if (useAI) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-questions', {
          body: { flashcards: selectedCards, questionTypes: selectedTypes, count }
        });

        if (error) throw error;
        
        if (data?.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setTestStarted(true);
          if (timeLimit > 0) setTimeRemaining(timeLimit * 60);
          toast.dismiss("generating-test");
          toast.success("Test ready!");
          setIsGenerating(false);
          return;
        }
      } catch (error) {
        console.error('AI generation failed:', error);
        toast.dismiss("generating-test");
        toast.error("AI generation failed, using manual questions");
      }
    }

    // Fallback: generate questions manually
    const manualQuestions: Question[] = selectedCards.map(card => {
      const type = selectedTypes[Math.floor(Math.random() * selectedTypes.length)] as Question['question_type'];
      
      if (type === 'multiple_choice') {
        const otherCards = flashcards.filter(c => c.id !== card.id);
        const wrongOptions = otherCards.sort(() => Math.random() - 0.5).slice(0, 3).map(c => c.definition);
        const options = [card.definition, ...wrongOptions].sort(() => Math.random() - 0.5);
        
        return {
          question_type: 'multiple_choice',
          question_text: `What is the definition of "${card.term}"?`,
          correct_answer: card.definition,
          options,
          explanation: `The correct definition is: ${card.definition}`
        };
      } else if (type === 'true_false') {
        const isTrue = Math.random() > 0.5;
        const displayDef = isTrue ? card.definition : flashcards.filter(c => c.id !== card.id)[0]?.definition || card.definition;
        
        return {
          question_type: 'true_false',
          question_text: `True or False: "${card.term}" means "${displayDef}"`,
          correct_answer: isTrue ? 'True' : 'False',
          options: ['True', 'False'],
          explanation: `The correct answer is ${isTrue ? 'True' : 'False'}. ${card.term} means ${card.definition}`
        };
      } else {
        return {
          question_type: 'fill_blank',
          question_text: `Define: ${card.term}`,
          correct_answer: card.definition,
          explanation: `The correct definition is: ${card.definition}`
        };
      }
    });

    setQuestions(manualQuestions);
    setTestStarted(true);
    if (timeLimit > 0) setTimeRemaining(timeLimit * 60);
    toast.dismiss("generating-test");
    toast.success("Test ready!");
    setIsGenerating(false);
  };

  const handleSubmit = () => {
    const current = { ...questions[currentIndex], user_answer: userAnswer };
    const updated = [...questions];
    updated[currentIndex] = current;
    setQuestions(updated);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
    } else {
      finishTest();
    }
  };

  const finishTest = () => {
    setShowResults(true);
    setTimeRemaining(null);
  };

  const toggleQuestionType = (type: string) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter(t => t !== type));
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!testStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-2xl w-full space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Test Settings</h2>
            <p className="text-muted-foreground">{setTitle}</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Question Types</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="mc" 
                    checked={selectedTypes.includes('multiple_choice')}
                    onCheckedChange={() => toggleQuestionType('multiple_choice')}
                  />
                  <Label htmlFor="mc" className="cursor-pointer">Multiple Choice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="tf" 
                    checked={selectedTypes.includes('true_false')}
                    onCheckedChange={() => toggleQuestionType('true_false')}
                  />
                  <Label htmlFor="tf" className="cursor-pointer">True/False</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fb" 
                    checked={selectedTypes.includes('fill_blank')}
                    onCheckedChange={() => toggleQuestionType('fill_blank')}
                  />
                  <Label htmlFor="fb" className="cursor-pointer">Fill in the Blank</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="count">Number of Questions (max {Math.min(flashcards.length, 40)})</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max={Math.min(flashcards.length, 40)}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.min(Number(e.target.value), flashcards.length, 40))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time Limit (minutes, 0 for no limit)</Label>
              <Input
                id="time"
                type="number"
                min="0"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <Label htmlFor="ai">Use AI to Generate Questions</Label>
              </div>
              <Checkbox 
                id="ai" 
                checked={useAI}
                onCheckedChange={(checked) => setUseAI(checked as boolean)}
              />
            </div>
          </div>

          <Button 
            onClick={generateQuestions} 
            className="w-full" 
            size="lg"
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Start Test"}
          </Button>
        </Card>
      </div>
    );
  }

  if (showResults) {
    const correctAnswers = questions.filter(q => {
      if (q.question_type === 'fill_blank') {
        return q.user_answer?.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
      }
      return q.user_answer === q.correct_answer;
    }).length;
    const percentage = Math.round((correctAnswers / questions.length) * 100);

    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="p-8 max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold text-center">Test Complete!</h2>
          <div className="text-center space-y-2">
            <div className="text-6xl font-bold text-primary">{percentage}%</div>
            <div className="text-muted-foreground">
              {correctAnswers} out of {questions.length} correct
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => {
              const isCorrect = q.question_type === 'fill_blank'
                ? q.user_answer?.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
                : q.user_answer === q.correct_answer;

              return (
                <div
                  key={i}
                  className={cn(
                    "p-4 rounded-lg space-y-2",
                    isCorrect ? "bg-success/20" : "bg-destructive/20"
                  )}
                >
                  <div className="font-semibold">{q.question_text}</div>
                  <div className="text-sm">
                    <span className="font-medium">Your answer: </span>
                    {q.user_answer || "(not answered)"}
                  </div>
                  {!isCorrect && (
                    <div className="text-sm">
                      <span className="font-medium">Correct answer: </span>
                      {q.correct_answer}
                    </div>
                  )}
                  {q.explanation && (
                    <div className="text-sm italic opacity-80">{q.explanation}</div>
                  )}
                </div>
              );
            })}
          </div>

          <Button onClick={() => navigate("/")} className="w-full">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-center flex-1">
              <h1 className="font-semibold">{setTitle} - Test</h1>
              <p className="text-sm text-muted-foreground">
                Question {currentIndex + 1} / {questions.length}
              </p>
            </div>
            {timeRemaining !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-sm text-muted-foreground uppercase tracking-wide">
              {currentQuestion.question_type.replace('_', ' ')}
            </div>
            <div className="text-2xl font-bold">{currentQuestion.question_text}</div>
          </div>

          {currentQuestion.question_type === 'fill_blank' ? (
            <div className="space-y-4">
              <Input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && userAnswer && handleSubmit()}
                placeholder="Type your answer..."
                className="text-lg"
                autoFocus
              />
              <Button
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
                className="w-full"
                size="lg"
              >
                {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Test'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <RadioGroup value={userAnswer} onValueChange={setUserAnswer}>
                {(currentQuestion.options || []).map((option, i) => (
                  <div key={i} className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-all duration-200 hover:scale-[1.02]">
                    <RadioGroupItem value={option} id={`option-${i}`} />
                    <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button
                onClick={handleSubmit}
                disabled={!userAnswer}
                className="w-full"
                size="lg"
              >
                {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Test'}
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default TestMode;
