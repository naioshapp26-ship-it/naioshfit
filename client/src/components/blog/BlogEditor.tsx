import { useCallback, useMemo, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";

interface BlogEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function BlogEditor({ value, onChange, placeholder }: BlogEditorProps) {
  const quillRef = useRef<ReactQuill | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleImageUpload = useCallback(() => {
    const url = window.prompt(t("blogInsertImageUrl"));
    const editor = quillRef.current?.getEditor();
    const range = editor?.getSelection(true);

    if (url && editor && range) {
      editor.insertEmbed(range.index, "image", url, "user");
      editor.setSelection(range.index + 1, 0);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/blog/uploads", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        if (!data?.url) {
          throw new Error("Upload failed");
        }

        if (editor && range) {
          editor.insertEmbed(range.index, "image", data.url, "user");
          editor.setSelection(range.index + 1, 0);
        }
      } catch (error) {
        toast({
          title: t("error"),
          description: t("blogImageUploadError"),
          variant: "destructive",
        });
      }
    };
    input.click();
  }, [t, toast]);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: handleImageUpload,
        },
      },
      clipboard: {
        matchVisual: true,
      },
    }),
    [handleImageUpload]
  );

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "list",
    "bullet",
    "link",
    "image",
  ];

  return (
    <ReactQuill
      ref={quillRef}
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      formats={formats}
      placeholder={placeholder}
    />
  );
}
