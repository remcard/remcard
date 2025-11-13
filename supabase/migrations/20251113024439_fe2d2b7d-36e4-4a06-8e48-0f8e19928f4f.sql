-- Add theme column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN theme text DEFAULT 'normal' NOT NULL;