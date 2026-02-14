import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Quote,
	Redo,
	Strikethrough,
	Underline as UnderlineIcon,
	Undo,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
	content: string;
	onChange: (content: string) => void;
	placeholder?: string;
	className?: string;
	editable?: boolean;
}

export function RichTextEditor({
	content,
	onChange,
	placeholder = "Start writing your content...",
	className,
	editable = true,
}: RichTextEditorProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: false,
			}),
			Underline,
			Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					class: "text-primary underline",
				},
			}),
			Placeholder.configure({
				placeholder,
			}),
			TextAlign.configure({
				types: ["heading", "paragraph"],
			}),
		],
		content: content,
		editable,
		onUpdate: ({ editor }) => {
			onChange(editor.getHTML());
		},
		editorProps: {
			attributes: {
				class:
					"prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3",
			},
		},
	});

	useEffect(() => {
		if (editor && content !== editor.getHTML()) {
			editor.commands.setContent(content);
		}
	}, [content, editor]);

	if (!editor) {
		return null;
	}

	const addLink = () => {
		const url = window.prompt("Enter URL:");
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		}
	};

	const ToolbarButton = ({
		onClick,
		isActive = false,
		disabled = false,
		children,
		tooltip,
	}: {
		onClick: () => void;
		isActive?: boolean;
		disabled?: boolean;
		children: React.ReactNode;
		tooltip: string;
	}) => (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onClick}
					disabled={disabled}
					className={cn(
						"h-8 w-8 p-0",
						isActive && "bg-primary/20 text-primary",
					)}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<p>{tooltip}</p>
			</TooltipContent>
		</Tooltip>
	);

	return (
		<TooltipProvider delayDuration={300}>
			<div
				className={cn(
					"rich-text-editor rounded-lg border border-border/40 bg-background",
					className,
				)}
			>
				{/* Toolbar */}
				<div className="flex flex-wrap items-center gap-1 border-b border-border/40 p-2">
					{/* Undo/Redo */}
					<ToolbarButton
						onClick={() => editor.chain().focus().undo().run()}
						disabled={!editor.can().undo()}
						tooltip="Undo"
					>
						<Undo className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().redo().run()}
						disabled={!editor.can().redo()}
						tooltip="Redo"
					>
						<Redo className="h-4 w-4" />
					</ToolbarButton>

					<div className="mx-1 h-6 w-px bg-border/40" />

					{/* Text Formatting */}
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleBold().run()}
						isActive={editor.isActive("bold")}
						tooltip="Bold"
					>
						<Bold className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleItalic().run()}
						isActive={editor.isActive("italic")}
						tooltip="Italic"
					>
						<Italic className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleUnderline().run()}
						isActive={editor.isActive("underline")}
						tooltip="Underline"
					>
						<UnderlineIcon className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleStrike().run()}
						isActive={editor.isActive("strike")}
						tooltip="Strikethrough"
					>
						<Strikethrough className="h-4 w-4" />
					</ToolbarButton>

					<div className="mx-1 h-6 w-px bg-border/40" />

					{/* Alignment */}
					<ToolbarButton
						onClick={() => editor.chain().focus().setTextAlign("left").run()}
						isActive={editor.isActive({ textAlign: "left" })}
						tooltip="Align Left"
					>
						<AlignLeft className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().setTextAlign("center").run()}
						isActive={editor.isActive({ textAlign: "center" })}
						tooltip="Align Center"
					>
						<AlignCenter className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().setTextAlign("right").run()}
						isActive={editor.isActive({ textAlign: "right" })}
						tooltip="Align Right"
					>
						<AlignRight className="h-4 w-4" />
					</ToolbarButton>

					<div className="mx-1 h-6 w-px bg-border/40" />

					{/* Lists & Quote */}
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleBulletList().run()}
						isActive={editor.isActive("bulletList")}
						tooltip="Bullet List"
					>
						<List className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
						isActive={editor.isActive("orderedList")}
						tooltip="Numbered List"
					>
						<ListOrdered className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleBlockquote().run()}
						isActive={editor.isActive("blockquote")}
						tooltip="Quote"
					>
						<Quote className="h-4 w-4" />
					</ToolbarButton>
					<ToolbarButton
						onClick={addLink}
						isActive={editor.isActive("link")}
						tooltip="Add Link"
					>
						<LinkIcon className="h-4 w-4" />
					</ToolbarButton>
				</div>

				{/* Editor Content */}
				<EditorContent
					editor={editor}
					className="min-h-[400px] max-h-[600px] overflow-y-auto"
				/>
			</div>
		</TooltipProvider>
	);
}

// Helper function to strip HTML tags for plain text fallback
export function stripHtml(html: string): string {
	const tmp = document.createElement("div");
	tmp.innerHTML = html;
	return tmp.textContent || tmp.innerText || "";
}
