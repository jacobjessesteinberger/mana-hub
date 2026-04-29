-- Chat Attachments: Supabase Storage Bucket für Chat-Dateien
-- Dateien werden in Supabase Storage gespeichert, URLs in agent_messages.metadata.attachments

-- Storage Bucket erstellen (manuell in Supabase Dashboard oder via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true)
-- ON CONFLICT DO NOTHING;

-- Sicherstellen, dass metadata JSONB vorhanden ist (existiert bereits)
-- Die attachments werden als Array in metadata gespeichert:
-- metadata.attachments = [{ name: "foto.jpg", url: "https://...", type: "image/jpeg", size: 12345 }]
