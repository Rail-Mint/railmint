-- Drop the overly permissive public SELECT policy on likes
DROP POLICY IF EXISTS "Anyone can view likes" ON public.likes;

-- Allow only authenticated users to view likes
CREATE POLICY "Authenticated users can view likes"
ON public.likes
FOR SELECT
TO authenticated
USING (true);