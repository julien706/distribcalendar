import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminUserActionsRequest {
  action: 'delete' | 'reset_password'
  userId: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roleData || roleData.role !== 'admin') {
      console.error('Authorization error: User is not admin', { userId: user.id, roleError })
      return new Response(
        JSON.stringify({ error: 'Non autorisé - Admin uniquement' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { action, userId }: AdminUserActionsRequest = await req.json()

    console.log('Admin action requested:', { action, userId, adminId: user.id })

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Execute the requested action
    if (action === 'delete') {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      
      if (deleteError) {
        console.error('Error deleting user:', deleteError)
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la suppression de l\'utilisateur' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('User deleted successfully:', userId)
      return new Response(
        JSON.stringify({ success: true, message: 'Utilisateur supprimé' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (action === 'reset_password') {
      // Generate a password reset link
      const { data, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: (await supabaseAdmin.from('profiles').select('email').eq('id', userId).single()).data?.email || ''
      })

      if (resetError) {
        console.error('Error generating password reset link:', resetError)
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la génération du lien de réinitialisation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Password reset link generated for user:', userId)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lien de réinitialisation généré',
          resetLink: data.properties?.action_link 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Action inconnue' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
