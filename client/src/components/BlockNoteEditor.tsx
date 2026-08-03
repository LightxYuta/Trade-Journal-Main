import { useMemo } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { en } from "@blocknote/core/locales";
import { supabase } from "@/lib/supabase";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./BlockNoteEditor.css";

interface BlockNoteEditorProps {
  content: unknown[];
  onChange: (content: unknown[]) => void;
  editable?: boolean;
  placeholder?: string;
  /** Storage path prefix for pasted/dropped images, e.g. `daily-plans/${userId}` */
  uploadPathPrefix: string;
}

// Compresses + uploads a pasted/dropped image to the shared 'trade-charts'
// bucket, same pattern as uploadProtocolImage. BlockNote calls this whenever
// the user pastes an image (Ctrl+V) or drags a file into the editor.
async function uploadFile(file: File, pathPrefix: string): Promise<string> {
  const compressed: Blob = await new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 1600;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85);
    };
    img.src = url;
  });

  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("trade-charts").upload(path, compressed, {
    contentType: "image/jpeg",
  });
  if (error) throw error;
  const { data } = await supabase.storage.from("trade-charts").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl || path;
}

/**
 * Drop-in Notion-style editor. Used for:
 *  - Protocols page (replaces the old hand-rolled BlockEditor)
 *  - Daily Plan asset cards (plan body + reconciliation body)
 *
 * Supports direct Ctrl+V image paste, drag-drop, block splitting ("/" menu),
 * headings, lists, tables, callouts, etc. — all out of the box from BlockNote.
 */
export default function BlockNoteEditorView({
  content,
  onChange,
  editable = true,
  placeholder = "Start writing, or press '/' for commands...",
  uploadPathPrefix,
}: BlockNoteEditorProps) {
  // useCreateBlockNote must receive a stable initial content on first mount;
  // switching `content` after mount (e.g. navigating between asset cards)
  // requires a fresh editor instance, which is why callers should pass a
  // `key` prop (e.g. key={assetPlan.id}) to force remount per document.
  const initialContent = useMemo(
    () => (content && content.length > 0 ? (content as any) : undefined),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const editor = useCreateBlockNote({
    initialContent,
    uploadFile: (file: File) => uploadFile(file, uploadPathPrefix),
    dictionary: {
      ...en,
      placeholders: { ...en.placeholders, default: placeholder, emptyDocument: placeholder },
    },
  });

  return (
    <div className="bn-dark-wrapper">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="dark"
        onChange={() => onChange(editor.document as unknown[])}
      />
    </div>
  );
}
