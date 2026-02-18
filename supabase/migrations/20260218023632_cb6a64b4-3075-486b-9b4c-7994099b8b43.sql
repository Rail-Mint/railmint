-- Drop the misconfigured restrictive SELECT policy on creators
DROP POLICY IF EXISTS "Authenticated users can view creators" ON public.creators;

-- Add a proper PERMISSIVE SELECT policy so all clients can read creator profiles
-- (creators are public directory data, not private)
CREATE POLICY "Anyone can view creators"
ON public.creators
FOR SELECT
USING (true);
