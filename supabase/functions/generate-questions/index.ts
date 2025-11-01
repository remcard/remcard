import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { flashcards, questionTypes, count } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Generate ${count} diverse study questions from these flashcards:
${flashcards.map((f: any) => `Term: ${f.term}\nDefinition: ${f.definition}`).join('\n\n')}

Question types to include: ${questionTypes.join(', ')}

For each question, provide:
1. question_type (multiple_choice, true_false, or fill_blank)
2. question_text
3. correct_answer
4. options (for multiple_choice, array of 4 options including correct answer)
5. explanation

Return as JSON array.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful study assistant that generates educational questions. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      throw new Error('Failed to generate questions');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Extract JSON from response
    let questions;
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      questions = [];
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
