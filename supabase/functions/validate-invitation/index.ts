import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateInvitationRequest {
  code: string;
}

// Rate limiting: Track attempts per IP
const attemptsByIP = new Map<string, number[]>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60000; // 1 minute

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const now = Date.now();
    
    // Get recent attempts for this IP
    const attempts = attemptsByIP.get(clientIP) || [];
    const recentAttempts = attempts.filter(timestamp => now - timestamp < WINDOW_MS);
    
    if (recentAttempts.length >= MAX_ATTEMPTS) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ valid: false, error: "Trop de tentatives. Veuillez réessayer dans 1 minute." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Record this attempt
    recentAttempts.push(now);
    attemptsByIP.set(clientIP, recentAttempts);
    
    // Clean up old entries periodically (keep map from growing infinitely)
    if (attemptsByIP.size > 1000) {
      const cutoff = now - WINDOW_MS;
      for (const [ip, timestamps] of attemptsByIP.entries()) {
        const recent = timestamps.filter(t => t > cutoff);
        if (recent.length === 0) {
          attemptsByIP.delete(ip);
        } else {
          attemptsByIP.set(ip, recent);
        }
      }
    }

    const { code }: ValidateInvitationRequest = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ valid: false, error: "Code d'invitation requis" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if the invitation code exists and is active
    const { data, error } = await supabaseAdmin
      .from('invitation_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.log("Invalid invitation code:", code);
      return new Response(
        JSON.stringify({ valid: false, error: "Code d'invitation invalide" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Valid invitation code:", code);
    return new Response(
      JSON.stringify({ valid: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in validate-invitation function:", error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
