import { Accessor, JSX } from "solid-js";

declare module 'solid-js' {
  namespace JSX {
    interface HTMLAttributes<T> {
      role?: string;
    }
  }
}

export enum ErrorCode {
  FileInvalidType = "file-invalid-type",
  FileTooLarge = "file-too-large",
  FileTooSmall = "file-too-small",
  TooManyFiles = "too-many-files",
}

export interface FileError {
  message: string;
  code: ErrorCode | string;
}

export interface FileRejection {
  file: File;
  errors: FileError[];
}

export interface Accept {
  [key: string]: string[];
}

export type DropEvent = Event | Array<FileSystemFileHandle> | DataTransfer;

export interface DropzoneRef {
  open: () => void;
}

export interface DropzoneRootProps {
  refKey?: string;
  role?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onClick?: (event: MouseEvent) => void;
  onDragEnter?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  [key: string]: any;
}

export interface DropzoneInputProps
  extends JSX.InputHTMLAttributes<HTMLInputElement> {
  refKey?: string;
}

export interface DropzoneState {
  isFocused: () => boolean;
  isFileDialogActive: boolean;
  isDragActive: () => boolean;
  isDragAccept: Accessor<boolean>;
  isDragReject: Accessor<boolean>;
  acceptedFiles: Accessor<File[]>;
  fileRejections: Accessor<FileRejection[]>;
}

export interface DropzoneMethods {
  getRootProps: (props?: DropzoneRootProps) => DropzoneRootProps;
  getInputProps: (props?: DropzoneInputProps) => DropzoneInputProps;
  open: () => void;
  rootRef: HTMLElement | undefined;
  inputRef: HTMLInputElement | undefined;
}

export type DropzoneHookResult = DropzoneState & DropzoneMethods;

export interface DropzoneProps {
  ref?: Partial<DropzoneRef>; 
  accept?: Accept;
  multiple?: boolean;
  preventDropOnDocument?: boolean;
  noClick?: boolean;
  noKeyboard?: boolean;
  noDrag?: boolean;
  noDragEventsBubbling?: boolean;
  minSize?: number;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  getFilesFromEvent?: (event: DropEvent) => Promise<FileWithPath[]>;
  onFileDialogCancel?: () => void;
  onFileDialogOpen?: () => void;
  useFsAccessApi?: boolean;
  autoFocus?: boolean;
  onDragEnter?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: <T extends FileWithPath>(acceptedFiles: T[], fileRejections: FileRejection[], event: DropEvent | null) => void;
  onDropAccepted?: <T extends FileWithPath>(files: T[], event: DropEvent | null) => void;
  onDropRejected?: (fileRejections: FileRejection[], event: DropEvent | null) => void;
  onError?: (error: Error) => void;
  validator?: (file: File) => FileError | FileError[] | null;
  children?: 
    | JSX.Element           // allow normal JSX children
    | ((state: DropzoneHookResult) => JSX.Element);
}

export type GenericEventHandler = (event: any, ...args: any[]) => void;

export interface FileWithPath extends File {
  path?: string;
}

export async function fromEvent(eventOrHandles: Event | FileSystemFileHandle[]): Promise<FileWithPath[]> {
  const files: FileWithPath[] = [];
  
  // Handle FileSystemFileHandle[] (from File System Access API)
  if (Array.isArray(eventOrHandles)) {
    for (const handle of eventOrHandles) {
      const file = await handle.getFile();
      files.push(Object.assign(file, { path: handle.name }));
    }
    return files;
  }
  
  const event = eventOrHandles;
  
  if (event.type === 'drop') {
    const dropEvent = event as DragEvent;
    if (dropEvent.dataTransfer?.items) {
      // Handle DataTransferItemList
      for (let i = 0; i < dropEvent.dataTransfer.items.length; i++) {
        const item = dropEvent.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(Object.assign(file, { path: file.name }));
          }
        }
      }
    } else if (dropEvent.dataTransfer?.files) {
      // Handle FileList
      for (let i = 0; i < dropEvent.dataTransfer.files.length; i++) {
        const file = dropEvent.dataTransfer.files[i];
        files.push(Object.assign(file, { path: file.name }));
      }
    }
  } else if (event.type === 'change') {
    const inputEvent = event as Event;
    const target = inputEvent.target as HTMLInputElement;
    if (target?.files) {
      for (let i = 0; i < target.files.length; i++) {
        const file = target.files[i];
        files.push(Object.assign(file, { path: file.name }));
      }
    }
  }
  
  return files;
}