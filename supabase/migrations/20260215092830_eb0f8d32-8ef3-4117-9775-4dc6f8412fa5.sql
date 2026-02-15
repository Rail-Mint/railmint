-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view creators" ON public.creators;

-- Allow only authenticated users to view creators
CREATE POLICY "Authenticated users can view creators"
ON public.creators
FOR SELECT
TO authenticated
USING (true);