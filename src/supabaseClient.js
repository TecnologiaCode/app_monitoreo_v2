import { createClient } from '@supabase/supabase-js'

// 1. Obtén estos valores de tu Dashboard de Supabase (Configuración > API)
const supabaseUrl = 'https://twhqdoscxdcjvlqowcob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3aHFkb3NjeGRjanZscW93Y29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Mjc5MjEsImV4cCI6MjA3NzMwMzkyMX0._H_qgKoa9r3QKBCIGO_1bLVWLDVah3bFdsJKe4fsclc';

// 2. Crea y exporta el cliente
export const supabase = createClient(supabaseUrl, supabaseKey);
