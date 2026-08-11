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
  /** Category folder for pasted/dropped images, e.g. "protocols" or "daily-plans".
   *  The user's actual user_id is always inserted as the folder right after this,
   *  to match the existing storage RLS policy pattern (`{category}/{user_id}/...`). */
  uploadCategory: string;
  /** Optional extra identifier folded into the filename (not a folder segment,
   *  so it can never break the RLS path-shape check), e.g. a protocol or asset-plan id. */
  uploadIdHint?: string;
}

// Compresses + uploads a pasted/dropped image to the shared 'trade-charts'
// bucket. BlockNote calls this whenever the user pastes an image (Ctrl+V) or
// drags a file into the editor. IMPORTANT: BlockNote's core has no error
// handling around this call (confirmed in its source) — if this throws, the
// block gets stuck on "Loading..." forever with no visible error. So instead
// of rejecting on failure, we fall back to a local blob URL (shows the image
// immediately, just won't survive a refresh) and log the real error to the
// console so it's diagnosable.
async function uploadFile(file: File, category: string, idHint?: string): Promise<string> {
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
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.85);
    };
    img.onerror = () => resolve(file); // fall back to the raw file if it isn't decodable as an image
    img.src = url;
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");
    const idPart = idHint ? `${idHint}-` : "";
    const path = `${category}/${user.id}/${idPart}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from("trade-charts").upload(path, compressed, {
      contentType: "image/jpeg",
    });
    if (error) throw error;
    const { data } = await supabase.storage.from("trade-charts").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!data?.signedUrl) throw new Error("Could not get signed URL");
    return data.signedUrl;
  } catch (err) {
    console.error("[BlockNoteEditor] image upload failed, using local preview instead:", err);
    return URL.createObjectURL(compressed);
  }
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
  uploadCategory,
  uploadIdHint,
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
    uploadFile: (file: File) => uploadFile(file, uploadCategory, uploadIdHint),
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
