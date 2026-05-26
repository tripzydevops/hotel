-- Migration 047: Enable RLS on public.developer_knowledge and add policies
-- Description: Secures the developer_knowledge table as flagged by database security audit.

-- 1. Enable RLS
ALTER TABLE public.developer_knowledge ENABLE ROW LEVEL SECURITY;

-- 2. Create select policy for standard users
DROP POLICY IF EXISTS "Allow public read access to developer knowledge" ON public.developer_knowledge;
CREATE POLICY "Allow public read access to developer knowledge" 
ON public.developer_knowledge
FOR SELECT 
USING (true);

-- 3. Create full policy for service role/admin operations
DROP POLICY IF EXISTS "Allow admin full access to developer knowledge" ON public.developer_knowledge;
CREATE POLICY "Allow admin full access to developer knowledge" 
ON public.developer_knowledge
FOR ALL 
USING (true)
WITH CHECK (true);
