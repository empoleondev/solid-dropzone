import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, renderHook, waitFor } from '@solidjs/testing-library';
import { createSignal, Component, createRoot } from 'solid-js';
import { fromEvent } from 'file-selector';
import * as utils from '../src/utils';
import Dropzone, { useDropzone } from '../src/index';

// Mock DataTransfer for tests
type DragEffect = 'none' | 'copy' | 'link' | 'move';

class MockDataTransferItem {
  kind = 'file' as const;
  type: string;
  _file: File;

  constructor(file: File) {
    this.type = file.type;
    this._file = file;
  }

  getAsFile() {
    return this._file;
  }

  // You could also mock getAsString if you need it…
}

class MockDataTransfer {
  items: MockDataTransferItem[] = [];
  files: File[] = [];
  types: string[] = [];
  dropEffect: DragEffect = 'move';
  effectAllowed: DragEffect | 'copyLink' | 'copyMove' | 'linkMove' | 'all' = 'all';
  private _data: Record<string, string> = {};

  constructor() {
    // nothing
  }

  // file‑list methods
  addFile(file: File) {
    const item = new MockDataTransferItem(file);
    this.items.push(item);
    this.files.push(file);
    this.types.push('Files');
  }

  // legacy FileList support
  getFileList(): File[] {
    return this.files;
  }

  // DataTransferItemList interface
  remove(index: number) {
    this.items.splice(index, 1);
    this.files.splice(index, 1);
    if (!this.files.length) {
      const i = this.types.indexOf('Files');
      if (i > -1) this.types.splice(i, 1);
    }
  }

  clearData(format?: string) {
    if (format) {
      delete this._data[format];
    } else {
      this._data = {};
    }
  }

  setData(format: string, data: string) {
    this._data[format] = data;
    if (!this.types.includes(format)) {
      this.types.push(format);
    }
  }

  getData(format: string) {
    return this._data[format] || '';
  }

  // for convenience, so consumers of your helper can mimic
  // DOM event.dataTransfer without knowing your internals:
  toJSON() {
    return {
      items: this.items,
      files: this.files,
      types: this.types,
      dropEffect: this.dropEffect,
      effectAllowed: this.effectAllowed,
    };
  }
}

// In your test setup file (e.g. vitest.setup.ts):
Object.defineProperty(window, 'DataTransfer', {
  writable: true,
  configurable: true,
  value: MockDataTransfer,
});

// And then your helper becomes:
export function createDtWithFiles(files: File[] = []) {
  const dt = new MockDataTransfer();
  files.forEach(file => dt.addFile(file));
  return { dataTransfer: dt as unknown as DataTransfer };
}

describe("useDropzone() hook", () => {
  let files: File[];
  let images: File[];

  beforeEach(() => {
    files = [createFile("file1.pdf", 1111, "application/pdf")];
    images = [
      createFile("cats.gif", 1234, "image/gif"),
      createFile("dogs.gif", 2345, "image/jpeg"),
    ];
  });

  afterEach(cleanup);

  describe("behavior", () => {
    it("renders the root and input nodes with the necessary props", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      expect(container.innerHTML).toMatchSnapshot();
    });

    it("sets {accept} prop on the <input>", () => {
      const accept = {
        "image/jpeg": [],
      };
      const { container } = render(() => (
        <Dropzone accept={accept}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      expect(container.querySelector("input")).toHaveAttribute(
        "accept",
        "image/jpeg"
      );
    });

    it("updates {multiple} prop on the <input> when it changes", () => {
      const [accept, setAccept] = createSignal<Record<string, string[]>>({
        "image/jpeg": [],
      });
      
      const DropzoneComponent = () => (
        <Dropzone
          accept={accept()}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);

      expect(container.querySelector("input")).toHaveAttribute(
        "accept",
        "image/jpeg"
      );

      setAccept({
        "image/png": [],
      });

      expect(container.querySelector("input")).toHaveAttribute(
        "accept",
        "image/png"
      );
    });

    it("sets {multiple} prop on the <input>", () => {
      const { container } = render(() => (
        <Dropzone multiple>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      expect(container.querySelector("input")).toHaveAttribute("multiple");
    });

    it("updates {multiple} prop on the <input> when it changes", () => {
      const [multiple, setMultiple] = createSignal(false);

      const DropzoneComponent = () => (
        <Dropzone multiple={multiple()}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);

      expect(container.querySelector("input")).not.toHaveAttribute("multiple");

      setMultiple(true);

      expect(container.querySelector("input")).toHaveAttribute("multiple");
    });

    it("sets any props passed to the input props getter on the <input>", () => {
      const name = "dropzone-input";
      const { container } = render(() => (
        <Dropzone multiple>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps({ name })} />
            </div>
          )}
        </Dropzone>
      ));

      expect(container.querySelector("input")).toHaveAttribute("name", name);
    });

    it("sets any props passed to the root props getter on the root node", () => {
      const ariaLabel = "Dropzone area";
      const { container } = render(() => (
        <Dropzone multiple>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps({ "aria-label": ariaLabel })}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      expect(container.querySelector("div")).toHaveAttribute(
        "aria-label",
        ariaLabel
      );
    });

    it("runs the custom callback handlers provided to the root props getter", async () => {
      const event = createDtWithFiles(files);

      const rootProps = {
        onClick: vi.fn(),
        onKeyDown: vi.fn(),
        onFocus: vi.fn(),
        onBlur: vi.fn(),
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps(rootProps)}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("Dropzone element not found");

      fireEvent.click(dropzone);
      expect(rootProps.onClick).toHaveBeenCalled();

      fireEvent.focus(dropzone);
      fireEvent.keyDown(dropzone);
      expect(rootProps.onFocus).toHaveBeenCalled();
      expect(rootProps.onKeyDown).toHaveBeenCalled();

      fireEvent.blur(dropzone);
      expect(rootProps.onBlur).toHaveBeenCalled();

      fireEvent.dragEnter(dropzone, event);
      expect(rootProps.onDragEnter).toHaveBeenCalled();

      fireEvent.dragOver(dropzone, event);
      expect(rootProps.onDragOver).toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, event);
      expect(rootProps.onDragLeave).toHaveBeenCalled();

      fireEvent.drop(dropzone, event);
      expect(rootProps.onDrop).toHaveBeenCalled();
    });

    it("runs the custom callback handlers provided to the input props getter", async () => {
      const inputProps = {
        onClick: vi.fn(),
        onChange: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps(inputProps)} />
            </div>
          )}
        </Dropzone>
      ));

      const input = container.querySelector("input") as HTMLInputElement;
      if (!input) throw new Error("Input element not found");

      fireEvent.click(input);
      expect(inputProps.onClick).toHaveBeenCalled();

      fireEvent.change(input, { target: { files: [] } });
      expect(inputProps.onChange).toHaveBeenCalled();
    });

    it("runs no callback handlers if {disabled} is true", async () => {
      const event = createDtWithFiles(files);

      const rootProps = {
        onClick: vi.fn(),
        onKeyDown: vi.fn(),
        onFocus: vi.fn(),
        onBlur: vi.fn(),
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const inputProps = {
        onClick: vi.fn(),
        onChange: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone disabled>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps(rootProps)}>
              <input {...getInputProps(inputProps)} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("Dropzone element not found");

      fireEvent.click(dropzone);
      expect(rootProps.onClick).not.toHaveBeenCalled();

      fireEvent.focus(dropzone);
      fireEvent.keyDown(dropzone);
      expect(rootProps.onFocus).not.toHaveBeenCalled();
      expect(rootProps.onKeyDown).not.toHaveBeenCalled();

      fireEvent.blur(dropzone);
      expect(rootProps.onBlur).not.toHaveBeenCalled();

      fireEvent.dragEnter(dropzone, event);
      expect(rootProps.onDragEnter).not.toHaveBeenCalled();

      fireEvent.dragOver(dropzone, event);
      expect(rootProps.onDragOver).not.toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, event);
      expect(rootProps.onDragLeave).not.toHaveBeenCalled();

      fireEvent.drop(dropzone, event);
      expect(rootProps.onDrop).not.toHaveBeenCalled();

      const input = container.querySelector("input");
      if (!input) throw new Error("Input element not found");

      fireEvent.click(input);
      expect(inputProps.onClick).not.toHaveBeenCalled();

      fireEvent.change(input);
      expect(inputProps.onChange).not.toHaveBeenCalled();
    });

    test('{rootRef, inputRef} are exposed', async () => {
      let rootRef!: HTMLElement;
      let inputRef!: HTMLInputElement;

      const Test = () => {
        const dz = useDropzone();
        const rootProps = dz.getRootProps({ refKey: 'ref' });
        const inputProps = dz.getInputProps({ refKey: 'ref' });

        rootProps.ref = (el: HTMLElement) => (rootRef = el);
        inputProps.ref = (el: HTMLInputElement) => (inputRef = el);

        return (
          <div {...rootProps}>
            <input {...inputProps} />
          </div>
        );
      };

      const { container } = render(Test);

      await waitFor(() => {
        expect(rootRef).toBeInstanceOf(HTMLDivElement);
        expect(inputRef).toBeInstanceOf(HTMLInputElement);
      });

      // additionally ensure they point to the right elements
      expect(container.querySelector('div')).toBe(rootRef);
      expect(container.querySelector('input')).toBe(inputRef);
    });

    // test("<Dropzone> exposes and sets the ref if using a ref object", () => {
    //   const dropzoneRef = createRef();
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    //   const ui = (
    //     <Dropzone ref={dropzoneRef}>
    //       {({ getRootProps, getInputProps, isFocused }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFocused && <div id="focus" />}
    //         </div>
    //       )}
    //     </Dropzone>
    //   );

    //   const { rerender } = render(() => ui);

    //   expect(dropzoneRef.current).not.toBeNull();
    //   expect(typeof dropzoneRef.current.open).toEqual("function");

    //   // act(() => dropzoneRef.current.open());
    //   expect(onClickSpy).toHaveBeenCalled();

    //   rerender(null);

    //   expect(dropzoneRef.current).toBeNull();
    // });

    // test("<Dropzone> exposes and sets the ref if using a ref fn", () => {
    //   let dropzoneRef;
    //   const setRef = (ref) => (dropzoneRef = ref);
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    //   const ui = (
    //     <Dropzone ref={setRef}>
    //       {({ getRootProps, getInputProps, isFocused }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFocused && <div id="focus" />}
    //         </div>
    //       )}
    //     </Dropzone>
    //   );

    //   const { rerender } = render(ui);

    //   expect(dropzoneRef).not.toBeNull();
    //   expect(typeof dropzoneRef.open).toEqual("function");

    //   // act(() => dropzoneRef.open());
    //   expect(onClickSpy).toHaveBeenCalled();

    //   rerender(null);
    //   expect(dropzoneRef).toBeNull();
    // });

    // test("<Dropzone> doesn't invoke the ref fn if it hasn't changed", () => {
    //   const setRef = vi.fn();

    //   const { rerender } = render(() => (
    //     <Dropzone ref={setRef}>
    //       {({ getRootProps, getInputProps }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   rerender(
    //     <Dropzone ref={setRef}>
    //       {({ getRootProps }) => <div {...getRootProps()} />}
    //     </Dropzone>
    //   );

    //   expect(setRef).toHaveBeenCalledTimes(1);
    // });

    it("sets {isFocused} to false if {disabled} is true", () => {
      const [disabled, setDisabled] = createSignal(false);

      const DropzoneComponent = () => (
        <Dropzone disabled={disabled()}>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();

      setDisabled(true);

      expect(dropzone.querySelector("#focus")).toBeNull();
    });


    test("{tabindex} is 0 if {disabled} is false", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      expect(container.querySelector("div")).toHaveAttribute("tabindex", "0");
    });

    it("tabindex is not set if {disabled} is true", () => {
      const [disabled, setDisabled] = createSignal(false);

      const DropzoneComponent = () => (
        <Dropzone disabled={disabled()}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      expect(dropzone).toHaveAttribute("tabindex", "0");

      setDisabled(true);
      expect(dropzone).not.toHaveAttribute("tabindex");
    });

    it("tabindex is not set if {noKeyboard} is true", () => {
      const [noKeyboard, setNoKeyboard] = createSignal(false);

      const DropzoneComponent = () => (
        <Dropzone noKeyboard={noKeyboard()}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      expect(dropzone).toHaveAttribute("tabindex", "0");

      setNoKeyboard(true);
      expect(dropzone).not.toHaveAttribute("tabindex");
    });

    // test("refs are set when {refKey} is set to a different value", (done) => {
    //   const data = createDtWithFiles(files);

    //   class MyView extends React.Component {
    //     render() {
    //       const { children, innerRef, ...rest } = this.props;
    //       return (
    //         <div id="dropzone" ref={innerRef} {...rest}>
    //           <div>{children}</div>
    //         </div>
    //       );
    //     }
    //   }

    //   const ui = (
    //     <Dropzone>
    //       {({ getRootProps }) => (
    //         <MyView {...getRootProps({ refKey: "innerRef" })}>
    //           <span>Drop some files here ...</span>
    //         </MyView>
    //       )}
    //     </Dropzone>
    //   );

    //   const { container, rerender } = render(ui);
    //   const dropzone = container.querySelector("#dropzone");

    //   const fn = async () => {
    //     // await act(() => fireEvent.drop(dropzone, data));
    //     rerender(ui);
    //     done();
    //   };

    //   expect(fn).not.toThrow();
    // });

  //   test("click events originating from <label> should not trigger file dialog open twice", () => {
  //     const activeRef = createRef();
  //     const active = <span ref={activeRef}>I am active</span>;
  //     const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

  //     const { container } = render(() => (
  //       <Dropzone>
  //         {({ getRootProps, getInputProps, isFileDialogActive }) => (
  //           <label {...getRootProps()}>
  //             <input {...getInputProps()} />
  //             {isFileDialogActive && active}
  //           </label>
  //         )}
  //       </Dropzone>
  //     ));

  //     const dropzone = container.querySelector("label");

  //     fireEvent.click(dropzone, { bubbles: true, cancelable: true });

  //     expect(activeRef.current).not.toBeNull();
  //     expect(dropzone).toContainElement(activeRef.current);
  //     expect(onClickSpy).toHaveBeenCalledTimes(1);
  //   });
  });

  describe("document drop protection", () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
    // Collect the list of addEventListener/removeEventListener spy calls into an object keyed by event name
    const collectEventListenerCalls = (spy) =>
      spy.mock.calls.reduce(
        (acc, [eventName, ...rest]) => ({
          ...acc,
          [eventName]: rest,
        }),
        {}
      );

    beforeEach(() => {
      addEventListenerSpy    = vi.spyOn(document, "addEventListener");
      removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it("installs hooks to prevent stray drops from taking over the browser window", () => {
      render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

      const addEventCalls = collectEventListenerCalls(addEventListenerSpy);
      const events = Object.keys(addEventCalls);

      expect(events).toContain("dragover");
      expect(events).toContain("drop");

      events.forEach((eventName) => {
        const [fn, options] = addEventCalls[eventName];
        expect(fn).toBeDefined();
        expect(options).toBe(false);
      });
    });

    it("removes document hooks when unmounted", () => {
      const { unmount } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);

      const addEventCalls = collectEventListenerCalls(addEventListenerSpy);
      const removeEventCalls = collectEventListenerCalls(
        removeEventListenerSpy
      );
      const events = Object.keys(removeEventCalls);

      expect(events).toContain("dragover");
      expect(events).toContain("drop");

      events.forEach((eventName) => {
        const [a] = addEventCalls[eventName];
        const [b] = removeEventCalls[eventName];
        expect(a).toEqual(b);
      });
    });

    it("terminates drags and drops on elements outside our dropzone", () => {
      render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dragEvt = new Event("dragover", { bubbles: true });
      const dragEvtPreventDefaultSpy = vi.spyOn(dragEvt, "preventDefault");
      fireEvent(document.body, dragEvt);
      expect(dragEvtPreventDefaultSpy).toHaveBeenCalled();

      const dropEvt = new Event("drop", { bubbles: true });
      const dropEvtPreventDefaultSpy = vi.spyOn(dropEvt, "preventDefault");
      fireEvent(document.body, dropEvt);
      expect(dropEvtPreventDefaultSpy).toHaveBeenCalled();
    });

    it("permits drags and drops on elements inside our dropzone", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropEvt = new Event("drop", { bubbles: true });
      const dropEvtPreventDefaultSpy = vi.spyOn(dropEvt, "preventDefault");

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("div element not found");

      fireEvent(dropzone, dropEvt);
      // A call is from the onDrop handler for the dropzone,
      // but there should be no more than 1
      expect(dropEvtPreventDefaultSpy).toHaveBeenCalled();
    });

    it("does not prevent stray drops when {preventDropOnDocument} is false", () => {
      render(() => (
        <Dropzone preventDropOnDocument={false}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropEvt = new Event("drop", { bubbles: true });
      const dropEvtPreventDefaultSpy = vi.spyOn(dropEvt, "preventDefault");
      fireEvent(document.body, dropEvt);
      expect(dropEvtPreventDefaultSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe("event propagation", () => {
    const data = createDtWithFiles(files);

    test("drag events propagate from the inner dropzone to parents", async () => {
      const innerProps = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const InnerDropzone = () => (
        <Dropzone {...innerProps}>
          {({ getRootProps, getInputProps }) => (
            <div id="inner-dropzone" {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const parentProps = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone {...parentProps}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <InnerDropzone />
            </div>
          )}
        </Dropzone>
      ));

      const innerDropzone = container.querySelector("#inner-dropzone");
      if (!innerDropzone) throw new Error("#inner-dropzone element not found");

      fireEvent.dragEnter(innerDropzone, data);
      expect(innerProps.onDragEnter).toHaveBeenCalled();
      expect(parentProps.onDragEnter).toHaveBeenCalled();

      fireEvent.dragOver(innerDropzone, data);
      expect(innerProps.onDragOver).toHaveBeenCalled();
      expect(parentProps.onDragOver).toHaveBeenCalled();

      fireEvent.dragLeave(innerDropzone, data);
      expect(innerProps.onDragLeave).toHaveBeenCalled();
      expect(parentProps.onDragLeave).toHaveBeenCalled();

      fireEvent.drop(innerDropzone, data);
      expect(innerProps.onDrop).toHaveBeenCalled();
      expect(parentProps.onDrop).toHaveBeenCalled();
    });

    test("drag events do not propagate from the inner dropzone to parent dropzone if user invoked stopPropagation() on the events", async () => {
      const innerProps = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      Object.keys(innerProps).forEach((prop) =>
        innerProps[prop].mockImplementation((...args) => {
          const event = prop === "onDrop" ? args.pop() : args.shift();
          event.stopPropagation();
        })
      );

      const InnerDropzone = () => (
        <Dropzone {...innerProps}>
          {({ getRootProps, getInputProps }) => (
            <div id="inner-dropzone" {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const parentProps = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone {...parentProps}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <InnerDropzone />
            </div>
          )}
        </Dropzone>
      ));

      const innerDropzone = container.querySelector("#inner-dropzone");
      if (!innerDropzone) throw new Error("#inner-dropzone element not found");

      fireEvent.dragEnter(innerDropzone, data);
      expect(innerProps.onDragEnter).toHaveBeenCalled();
      expect(parentProps.onDragEnter).not.toHaveBeenCalled();

      fireEvent.dragOver(innerDropzone, data);
      expect(innerProps.onDragOver).toHaveBeenCalled();
      expect(parentProps.onDragOver).not.toHaveBeenCalled();

      fireEvent.dragLeave(innerDropzone, data);
      expect(innerProps.onDragLeave).toHaveBeenCalled();
      expect(parentProps.onDragLeave).not.toHaveBeenCalled();

      fireEvent.drop(innerDropzone, data);
      expect(innerProps.onDrop).toHaveBeenCalled();
      expect(parentProps.onDrop).not.toHaveBeenCalled();
    });

    test("drag events do not propagate from the inner dropzone to parent dropzone if {noDragEventsBubbling} is true", async () => {
      const innerProps = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const InnerDropzone = () => (
        <Dropzone {...innerProps} noDragEventsBubbling>
          {({ getRootProps, getInputProps }) => (
            <div id="inner-dropzone" {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const parentProps = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone {...parentProps}>
          {({ getRootProps, getInputProps }) => (
            <div id="outer-dropzone" {...getRootProps()}>
              <input {...getInputProps()} />
              <InnerDropzone />
            </div>
          )}
        </Dropzone>
      ));

      const outerDropzone = container.querySelector("#outer-dropzone");
      if (!outerDropzone) throw new Error("#outer-dropzone element not found");
      const innerDropzone = container.querySelector("#inner-dropzone");
      if (!innerDropzone) throw new Error("#inner-dropzone element not found");

      // Sets drag targets on the outer dropzone
      fireEvent.dragEnter(outerDropzone, data);

      fireEvent.dragEnter(innerDropzone, data);
      expect(innerProps.onDragEnter).toHaveBeenCalled();
      expect(parentProps.onDragEnter).toHaveBeenCalledTimes(1);

      fireEvent.dragOver(innerDropzone, data);
      expect(innerProps.onDragOver).toHaveBeenCalled();
      expect(parentProps.onDragOver).not.toHaveBeenCalled();

      fireEvent.dragLeave(innerDropzone, data);
      expect(innerProps.onDragLeave).toHaveBeenCalled();
      expect(parentProps.onDragLeave).not.toHaveBeenCalled();

      fireEvent.drop(innerDropzone, data);
      expect(innerProps.onDrop).toHaveBeenCalled();
      expect(parentProps.onDrop).not.toHaveBeenCalled();
    });

    // test("onDragLeave is not invoked for the parent dropzone if it was invoked for an inner dropzone", async () => {
    //   const innerDragLeave = vi.fn();
    //   const InnerDropzone = () => (
    //     <Dropzone onDragLeave={innerDragLeave}>
    //       {({ getRootProps, getInputProps }) => (
    //         <div id="inner-dropzone" {...getRootProps()}>
    //           <input {...getInputProps()} />
    //         </div>
    //       )}
    //     </Dropzone>
    //   );

    //   const parentDragLeave = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone onDragLeave={parentDragLeave}>
    //       {({ getRootProps, getInputProps }) => (
    //         <div id="parent-dropzone" {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           <InnerDropzone />
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const parentDropzone = container.querySelector("#parent-dropzone");
    //   if (!parentDropzone) throw new Error("#parent-dropzone element not found");

    //   fireEvent.dragEnter(parentDropzone, data);

    //   const innerDropzone = container.querySelector("#inner-dropzone");
    //   if (!innerDropzone) throw new Error("#inner-dropzone element not found");
    //   fireEvent.dragEnter(innerDropzone, data);

    //   fireEvent.dragLeave(innerDropzone, data);
    //   expect(innerDragLeave).toHaveBeenCalled();
    //   expect(parentDragLeave).not.toHaveBeenCalled();
    // });
  });

  describe("plugin integration", () => {
    it("uses provided getFilesFromEvent()", async () => {
      const data = createDtWithFiles(files);

      const props = {
        getFilesFromEvent: vi
          .fn()
          .mockImplementation((event) => fromEvent(event)),
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone {...props}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("div element not found");

      fireEvent.dragEnter(dropzone, data);
      expect(props.onDragEnter).toHaveBeenCalled();

      fireEvent.dragOver(dropzone, data);
      expect(props.onDragOver).toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, data);
      expect(props.onDragLeave).toHaveBeenCalled();

      fireEvent.drop(dropzone, data);
      expect(props.onDrop).toHaveBeenCalled();
      expect(props.getFilesFromEvent).toHaveBeenCalledTimes(2);
    });

    // it("calls {onError} when getFilesFromEvent() rejects", async () => {
    //   const data = createDtWithFiles(files);

    //   const props = {
    //     getFilesFromEvent: vi
    //       .fn()
    //       .mockImplementation(() => Promise.reject("oops :(")),
    //     onDragEnter: vi.fn(),
    //     onDrop: vi.fn(),
    //     onError: vi.fn(),
    //   };

    //   const ui = (
    //     <Dropzone {...props}>
    //       {({ getRootProps, getInputProps }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //         </div>
    //       )}
    //     </Dropzone>
    //   );
    //   const { container } = render(() => ui);
    //   const dropzone = container.querySelector("div");
    //   if (!dropzone) throw new Error("dropzone element not found");

    //   fireEvent.dragEnter(dropzone, data);
    //   expect(props.onDragEnter).not.toHaveBeenCalled();

    //   fireEvent.drop(dropzone, data);
    //   expect(props.onDrop).not.toHaveBeenCalled();

    //   expect(props.getFilesFromEvent).toHaveBeenCalledTimes(2);
    //   expect(props.onError).toHaveBeenCalledTimes(2);
    // });
  });

  describe("onFocus", () => {
    it("sets focus state", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();
    });

    it("does not set focus state if user stopped event propagation", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div
              {...getRootProps({ onFocus: (event) => event.stopPropagation() })}
            >
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).toBeNull();
    });

    it("does not set focus state if {noKeyboard} is true", () => {
      const { container } = render(() => (
        <Dropzone noKeyboard>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).toBeNull();
    });

    it("restores focus behavior if {noKeyboard} is set back to false", () => {
      const [noKeyboard, setNoKeyboard] = createSignal(true);

      const DropzoneComponent = () => (
        <Dropzone noKeyboard={noKeyboard()}>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).toBeNull();

      setNoKeyboard(false);

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();
    });


    it("autoFocus sets the focus state on render", () => {
      const [autoFocus, setAutoFocus] = createSignal(false);
      const [disabled, setDisabled] = createSignal(false);

      const DropzoneComponent = () => (
        <Dropzone autoFocus={autoFocus()} disabled={disabled()}>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      expect(dropzone.querySelector("#focus")).toBeNull();

      setAutoFocus(true);
      expect(dropzone.querySelector("#focus")).not.toBeNull();

      setDisabled(true);
      expect(dropzone.querySelector("#focus")).toBeNull();
    });
  });

  describe("onBlur", () => {
    it("unsets focus state", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();

      fireEvent.blur(dropzone);
      expect(dropzone.querySelector("#focus")).toBeNull();
    });

    it("does not unset focus state if user stopped event propagation", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div
              {...getRootProps({ onBlur: (event) => event.stopPropagation() })}
            >
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();
      fireEvent.blur(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();
    });

    it("does not unset focus state if {noKeyboard} is true", () => {
      const [noKeyboard, setNoKeyboard] = createSignal(false);

      const DropzoneComponent = () => (
        <Dropzone noKeyboard={noKeyboard()}>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();

      setNoKeyboard(true);

      fireEvent.blur(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();
    });


    it("restores blur behavior if {noKeyboard} is set back to false", () => {
      const [noKeyboard, setNoKeyboard] = createSignal(false);

      const DropzoneComponent = () => (
        <Dropzone noKeyboard={noKeyboard()}>
          {({ getRootProps, getInputProps, isFocused }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isFocused() && <div id="focus" />}
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.focus(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();

      setNoKeyboard(true);
      fireEvent.blur(dropzone);
      expect(dropzone.querySelector("#focus")).not.toBeNull();

      setNoKeyboard(false);
      fireEvent.blur(dropzone);
      expect(dropzone.querySelector("#focus")).toBeNull();
    });

  });

  describe("onClick", () => {
    let currentShowOpenFilePicker;

    beforeEach(() => {
      currentShowOpenFilePicker = window.showOpenFilePicker;
    });

    afterEach(() => {
      if (currentShowOpenFilePicker) {
        window.showOpenFilePicker = currentShowOpenFilePicker;
      } else {
        delete window.showOpenFilePicker;
      }
    });

    // it("should proxy the click event to the input", () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    //   const { container } = render(() => (
    //     <Dropzone>
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);
    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);
    //   expect(onClickSpy).toHaveBeenCalled();
    // });

    it("should not not proxy the click event to the input if event propagation was stopped", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps({ onClick: (event) => event.stopPropagation() })}
            >
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div")
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.click(dropzone);
      expect(onClickSpy).not.toHaveBeenCalled();
    });

    it("should not not proxy the click event to the input if {noClick} is true", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone noClick>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div")
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.click(dropzone);
      expect(onClickSpy).not.toHaveBeenCalled();
    });

    it("restores click behavior if {noClick} is set back to false", async() => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

      const [noClick, setNoClick] = createSignal(true);

      const DropzoneComponent = () => (
        <Dropzone noClick={noClick()}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.click(dropzone);
      expect(onClickSpy).not.toHaveBeenCalled();

      setNoClick(false);

      fireEvent.click(dropzone);
      await waitFor(() => {
        expect(onClickSpy).toHaveBeenCalled();
      })
    });

    // https://github.com/react-dropzone/react-dropzone/issues/783
    it("should continue event propagation if {noClick} is true", () => {
      const btnClickSpy = vi.fn();
      const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone noClick>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button onClick={btnClickSpy} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.click(dropzone);
      expect(inputClickSpy).not.toHaveBeenCalled();

      const button = container.querySelector("button");
      if (!button) throw new Error("button element not found");

      fireEvent.click(button);
      expect(btnClickSpy).toHaveBeenCalled();
    });

    it("should schedule input click on next tick in Edge", () => {
      vi.useFakeTimers();

      const isIeOrEdgeSpy = vi
        .spyOn(utils, "isIeOrEdge")
        .mockReturnValueOnce(true);
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.click(dropzone);

      expect(onClickSpy).toHaveBeenCalled();
      vi.useRealTimers();
      isIeOrEdgeSpy.mockClear();
    });

    // it("should not use showOpenFilePicker() if supported and {useFsAccessApi} is not true", () => {
    //   vi.useFakeTimers();

    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    //   const showOpenFilePickerMock = vi.fn();

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const onDropSpy = vi.fn();
    //   const onFileDialogOpenSpy = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone
    //       onDrop={onDropSpy}
    //       onFileDialogOpen={onFileDialogOpenSpy}
    //       accept={{
    //         "application/pdf": [],
    //       }}
    //       multiple
    //     >
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(showOpenFilePickerMock).not.toHaveBeenCalled();
    //   expect(onClickSpy).toHaveBeenCalled();
    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();
    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);

    //   focusWindow();

    //   expect(activeRef.current).toBeNull();
    //   expect(dropzone).not.toContainElement(activeRef.current);
    //   expect(onDropSpy).not.toHaveBeenCalled();

    //   vi.useRealTimers();
    // });

    // it("should not use showOpenFilePicker() if supported and {isSecureContext} is not true", () => {
    //   vi.useFakeTimers();

    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    //   const showOpenFilePickerMock = vi.fn();

    //   window.showOpenFilePicker = showOpenFilePickerMock;
    //   window.isSecureContext = false;

    //   const onDropSpy = vi.fn();
    //   const onFileDialogOpenSpy = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone
    //       onDrop={onDropSpy}
    //       onFileDialogOpen={onFileDialogOpenSpy}
    //       accept={{
    //         "application/pdf": [],
    //       }}
    //       multiple
    //     >
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(showOpenFilePickerMock).not.toHaveBeenCalled();
    //   expect(onClickSpy).toHaveBeenCalled();
    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();
    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);

    //   focusWindow();

    //   expect(activeRef.current).toBeNull();
    //   expect(dropzone).not.toContainElement(activeRef.current);
    //   expect(onDropSpy).not.toHaveBeenCalled();

    //   vi.useRealTimers();

    //   window.isSecureContext = true;
    // });

    // it("should use showOpenFilePicker() if supported and {useFsAccessApi} is true, and not trigger click on input", async () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    //   const handlers = files.map((f) => createFileSystemFileHandle(f));
    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const onDropSpy = vi.fn();
    //   const onFileDialogOpenSpy = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone
    //       onDrop={onDropSpy}
    //       onFileDialogOpen={onFileDialogOpenSpy}
    //       accept={{
    //         "application/pdf": [],
    //       }}
    //       multiple
    //       useFsAccessApi
    //     >
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(showOpenFilePickerMock).toHaveBeenCalledWith({
    //     multiple: true,
    //     types: [
    //       {
    //         description: "Files",
    //         accept: { "application/pdf": [] },
    //       },
    //     ],
    //   });
    //   expect(onClickSpy).not.toHaveBeenCalled();
    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);

    //   // await act(() => thenable.done(handlers));

    //   expect(activeRef.current).toBeNull();
    //   expect(dropzone).not.toContainElement(activeRef.current);

    //   expect(onDropSpy).toHaveBeenCalledWith(files, [], null);
    // });

    // test("if showOpenFilePicker() is supported and {useFsAccessApi} is true, it should work without the <input>", async () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;

    //   const handlers = files.map((f) => createFileSystemFileHandle(f));
    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const onDropSpy = vi.fn();
    //   const onFileDialogOpenSpy = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone
    //       onDrop={onDropSpy}
    //       onFileDialogOpen={onFileDialogOpenSpy}
    //       useFsAccessApi
    //     >
    //       {({ getRootProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>{isFileDialogActive && active}</div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(showOpenFilePickerMock).toHaveBeenCalled();
    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();

    //   // await act(() => thenable.done(handlers));

    //   expect(activeRef.current).toBeNull();
    //   expect(dropzone).not.toContainElement(activeRef.current);
    //   expect(onDropSpy).toHaveBeenCalledWith(files, [], null);
    // });

    // test("if showOpenFilePicker() is supported and {useFsAccessApi} is true, and the user cancels it should call onFileDialogCancel", async () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;

    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const onDropSpy = vi.fn();
    //   const onFileDialogCancelSpy = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone
    //       onDrop={onDropSpy}
    //       onFileDialogCancel={onFileDialogCancelSpy}
    //       useFsAccessApi
    //     >
    //       {({ getRootProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>{isFileDialogActive && active}</div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(showOpenFilePickerMock).toHaveBeenCalled();

    //   await act(() =>
    //     thenable.cancel(new DOMException("user aborted request", "AbortError"))
    //   );

    //   expect(activeRef.current).toBeNull();
    //   expect(dropzone).not.toContainElement(activeRef.current);
    //   expect(onFileDialogCancelSpy).toHaveBeenCalled();
    //   expect(onDropSpy).not.toHaveBeenCalled();
    // });

    // test("window focus evt is not bound if showOpenFilePicker() is supported and {useFsAccessApi} is true", async () => {
    //   vi.useFakeTimers();

    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onFileDialogCancelSpy = vi.fn();

    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const { container } = render(() => (
    //     <Dropzone onFileDialogCancel={onFileDialogCancelSpy} useFsAccessApi>
    //       {({ getRootProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>{isFileDialogActive && active}</div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);

    //   await act(() =>
    //     thenable.cancel(new DOMException("user aborted request", "AbortError"))
    //   );

    //   // Try to focus window and run timers
    //   focusWindow();

    //   expect(activeRef.current).toBeNull();
    //   expect(dropzone).not.toContainElement(activeRef.current);
    //   expect(onFileDialogCancelSpy).toHaveBeenCalledTimes(1);

    //   vi.useRealTimers();
    // });

    // it("should try to use showOpenFilePicker() and fallback to input in case of a security error", async () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const onDropSpy = vi.fn();
    //   const onFileDialogOpenSpy = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone
    //       onDrop={onDropSpy}
    //       onFileDialogOpen={onFileDialogOpenSpy}
    //       accept={{
    //         "application/pdf": [],
    //       }}
    //       multiple
    //       useFsAccessApi
    //     >
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);
    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();

    //   await act(() =>
    //     thenable.cancel(
    //       new DOMException("Cannot use this API cross-origin", "SecurityError")
    //     )
    //   );

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);
    //   expect(onClickSpy).toHaveBeenCalled();
    // });

    // test("window focus evt is bound if showOpenFilePicker() is supported but errors due to a security error", async () => {
    //   vi.useFakeTimers();

    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onFileDialogCancelSpy = vi.fn();

    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const { container } = render(() => (
    //     <Dropzone onFileDialogCancel={onFileDialogCancelSpy} useFsAccessApi>
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);

    //   await act(() =>
    //     thenable.cancel(
    //       new DOMException("Cannot use this API cross-origin", "SecurityError")
    //     )
    //   );

    //   focusWindow();

    //   expect(onFileDialogCancelSpy).toHaveBeenCalled();
    //   expect(dropzone).not.toContainElement(activeRef.current);

    //   vi.useRealTimers();
    // });

    // test("showOpenFilePicker() should call {onError} when an unexpected error occurs", async () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;

    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const onErrorSpy = vi.fn();
    //   const onDropSpy = vi.fn();
    //   const onFileDialogOpenSpy = vi.fn();

    //   const ui = (
    //     <Dropzone
    //       onError={onErrorSpy}
    //       onDrop={onDropSpy}
    //       onFileDialogOpen={onFileDialogOpenSpy}
    //       accept={{
    //         "application/pdf": [],
    //       }}
    //       multiple
    //       useFsAccessApi
    //     >
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   );

    //   const { container } = render(ui);

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);
    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();

    //   const err = new Error("oops :(");
    //   // await act(() => thenable.cancel(err));
    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);
    //   expect(onErrorSpy).toHaveBeenCalledWith(err);
    // });

    // test("showOpenFilePicker() should call {onError} when a security error occurs and no <input> was provided", async () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;

    //   const thenable = createThenable();
    //   const showOpenFilePickerMock = vi
    //     .fn()
    //     .mockReturnValue(thenable.promise);

    //   window.showOpenFilePicker = showOpenFilePickerMock;

    //   const onErrorSpy = vi.fn();
    //   const onDropSpy = vi.fn();
    //   const onFileDialogOpenSpy = vi.fn();

    //   const ui = (
    //     <Dropzone
    //       onError={onErrorSpy}
    //       onDrop={onDropSpy}
    //       onFileDialogOpen={onFileDialogOpenSpy}
    //       accept={{
    //         "application/pdf": [],
    //       }}
    //       multiple
    //       useFsAccessApi
    //     >
    //       {({ getRootProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>{isFileDialogActive && active}</div>
    //       )}
    //     </Dropzone>
    //   );

    //   const { container } = render(ui);

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);
    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();

    //   const err = new DOMException("oops :(", "SecurityError");
    //   // await act(() => thenable.cancel(err));
    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);
    //   expect(onErrorSpy).toHaveBeenCalled();
    // });
  });

  describe("onKeyDown", () => {
    // it("triggers the click event on the input if the SPACE/ENTER keys are pressed", () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    //   const { container } = render(() => (
    //     <Dropzone>
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.keyDown(dropzone, {
    //     keyCode: 32, // Space
    //   });

    //   fireEvent.keyDown(dropzone, {
    //     keyCode: 13, // Enter
    //   });

    //   fireEvent.keyDown(dropzone, {
    //     key: " ", // Space
    //   });

    //   fireEvent.keyDown(dropzone, {
    //     key: "Enter",
    //   });

    //   const ref = activeRef.current;
    //   expect(ref).not.toBeNull();
    //   expect(dropzone).toContainElement(ref);
    //   expect(onClickSpy).toHaveBeenCalledTimes(4);
    // });

    it("does not trigger the click event on the input if the dropzone is not in focus", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const input = container.querySelector("input");
      if (!input) throw new Error("input element not found");

      fireEvent.keyDown(input, {
        keyCode: 32, // Space
      });

      fireEvent.keyDown(input, {
        key: " ", // Space
      });

      expect(onClickSpy).not.toHaveBeenCalled();
    });

    it("does not trigger the click event on the input if event propagation was stopped", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps({
                onKeyDown: (event) => event.stopPropagation(),
              })}
            >
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.keyDown(dropzone, {
        keyCode: 32, // Space
      });
      fireEvent.keyDown(dropzone, {
        key: " ", // Space
      });
      expect(onClickSpy).not.toHaveBeenCalled();
    });

    it("does not trigger the click event on the input if {noKeyboard} is true", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone noKeyboard>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.keyDown(dropzone, {
        keyCode: 32, // Space
      });
      fireEvent.keyDown(dropzone, {
        key: " ", // Space
      });
      expect(onClickSpy).not.toHaveBeenCalled();
    });

    it("restores the keydown behavior when {noKeyboard} is set back to false", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

      const [noKeyboard, setNoKeyboard] = createSignal(true);

      const DropzoneComponent = () => (
        <Dropzone noKeyboard={noKeyboard()}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.keyDown(dropzone, { keyCode: 32 });
      fireEvent.keyDown(dropzone, { key: " " });
      expect(onClickSpy).not.toHaveBeenCalled();

      setNoKeyboard(false);

      fireEvent.keyDown(dropzone, { keyCode: 32 });
      fireEvent.keyDown(dropzone, { key: " " });
      expect(onClickSpy).toHaveBeenCalledTimes(2);
    });

    it("does not trigger the click event on the input for other keys", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.keyDown(dropzone, {
        keyCode: 97, // Numpad1
      });
      fireEvent.keyDown(dropzone, {
        key: "1",
      });
      expect(onClickSpy).not.toHaveBeenCalled();
    });
  });

  describe("onDrag*", () => {
    it("invokes callbacks for the appropriate events", async () => {
      const data = createDtWithFiles(files);

      const props = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone {...props}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, data);
      expect(props.onDragEnter).toHaveBeenCalled();

      fireEvent.dragOver(dropzone, data);
      expect(props.onDragOver).toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, data);
      expect(props.onDragLeave).toHaveBeenCalled();

      fireEvent.drop(dropzone, data);
      expect(props.onDrop).toHaveBeenCalled();
    });

    it("invokes callbacks for the appropriate events even if it cannot access the data", async () => {
      const emptyData = createDtWithFiles([]);

      const props = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        onDropAccepted: vi.fn(),
        onDropRejected: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone {...props}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, emptyData);
      expect(props.onDragEnter).toHaveBeenCalled();

      fireEvent.dragOver(dropzone, emptyData);
      expect(props.onDragOver).toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, emptyData);
      expect(props.onDragLeave).toHaveBeenCalled();

      const data = createDtWithFiles(files);
      fireEvent.drop(dropzone, data);
      expect(props.onDrop).toHaveBeenCalled();
      expect(props.onDropAccepted).toHaveBeenCalledWith(
        files,
        expect.any(Object)
      );
      expect(props.onDropRejected).not.toHaveBeenCalled();
    });

    // it("does not invoke callbacks if no files are detected", async () => {
    //   const data = {
    //     dataTransfer: {
    //       items: [],
    //       types: ["text/html", "text/plain"],
    //     },
    //   };

    //   const props = {
    //     onDragEnter: vi.fn(),
    //     onDragOver: vi.fn(),
    //     onDragLeave: vi.fn(),
    //     onDrop: vi.fn(),
    //     onDropAccepted: vi.fn(),
    //     onDropRejected: vi.fn(),
    //   };

    //   const { container } = render(() => (
    //     <Dropzone {...props}>
    //       {({ getRootProps, getInputProps }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));
    //   const dropzone = container.querySelector("div");
    //   if (!dropzone) throw new Error("dropzone element not found");

    //   fireEvent.dragEnter(dropzone, data);
    //   expect(props.onDragEnter).not.toHaveBeenCalled();

    //   fireEvent.dragOver(dropzone, data);
    //   expect(props.onDragOver).not.toHaveBeenCalled();

    //   fireEvent.dragLeave(dropzone, data);
    //   expect(props.onDragLeave).not.toHaveBeenCalled();

    //   fireEvent.drop(dropzone, data);
    //   expect(props.onDrop).not.toHaveBeenCalled();
    //   expect(props.onDropAccepted).not.toHaveBeenCalled();
    //   expect(props.onDropRejected).not.toHaveBeenCalled();
    // });

    it("does not invoke callbacks if {noDrag} is true", async () => {
      const data = createDtWithFiles(files);

      const props = {
        onDragEnter: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        onDropAccepted: vi.fn(),
        onDropRejected: vi.fn(),
      };

      const { container } = render(() => (
        <Dropzone {...props} noDrag>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, data);
      expect(props.onDragEnter).not.toHaveBeenCalled();

      fireEvent.dragOver(dropzone, data);
      expect(props.onDragOver).not.toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, data);
      expect(props.onDragLeave).not.toHaveBeenCalled();

      fireEvent.drop(dropzone, data);
      expect(props.onDrop).not.toHaveBeenCalled();
      expect(props.onDropAccepted).not.toHaveBeenCalled();
      expect(props.onDropRejected).not.toHaveBeenCalled();
    });

    it("restores drag behavior if {noDrag} is set back to false", async () => {
      const data = createDtWithFiles(files);
      const props = {
        onDragEnter: vi.fn(),
        onDragOver:  vi.fn(),
        onDragLeave: vi.fn(),
        onDrop:      vi.fn(),
      };

      const [noDrag, setNoDrag] = createSignal(true);

      const DropzoneComponent = () => (
        <Dropzone {...props} noDrag={noDrag()}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.dragEnter(dropzone, data);
      expect(props.onDragEnter).not.toHaveBeenCalled();

      fireEvent.dragOver(dropzone, data);
      expect(props.onDragOver).not.toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, data);
      expect(props.onDragLeave).not.toHaveBeenCalled();

      fireEvent.drop(dropzone, data);
      expect(props.onDrop).not.toHaveBeenCalled();

      setNoDrag(false);

      fireEvent.dragEnter(dropzone, data);
      expect(props.onDragEnter).toHaveBeenCalled();

      fireEvent.dragOver(dropzone, data);
      expect(props.onDragOver).toHaveBeenCalled();

      fireEvent.dragLeave(dropzone, data);
      expect(props.onDragLeave).toHaveBeenCalled();

      fireEvent.drop(dropzone, data);
      expect(props.onDrop).toHaveBeenCalled();
    });

    it("sets {isDragActive} and {isDragAccept} if some files are accepted on dragenter", async () => {
      const { container } = render(() => (
        <Dropzone>
          {({
            getRootProps,
            getInputProps,
            isDragActive,
            isDragAccept,
            isDragReject,
          }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragActive() && "dragActive"}
              {isDragAccept() && "dragAccept"}
              {isDragReject() && "dragReject"}
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, createDtWithFiles(files));

      expect(dropzone).toHaveTextContent("dragActive");
      expect(dropzone).toHaveTextContent("dragAccept");
      expect(dropzone).not.toHaveTextContent("dragReject");
    });

    it("sets {isDragActive} and {isDragReject} of some files are not accepted on dragenter", async () => {
      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
        >
          {({
            getRootProps,
            getInputProps,
            isDragActive,
            isDragAccept,
            isDragReject,
          }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragActive() && "dragActive"}
              {isDragAccept() && "dragAccept"}
              {isDragReject() && "dragReject"}
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, createDtWithFiles([...files, ...images]))

      expect(dropzone).toHaveTextContent("dragActive");
      expect(dropzone).not.toHaveTextContent("dragAccept");
      expect(dropzone).toHaveTextContent("dragReject");
    });

    it("sets {isDragReject} if some files are too large", async () => {
      const { container } = render(() => (
        <Dropzone maxSize={0}>
          {({ getRootProps, getInputProps, isDragAccept, isDragReject }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragAccept() && "dragAccept"}
              {isDragReject() && "dragReject"}
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, createDtWithFiles(files));

      expect(dropzone).not.toHaveTextContent("dragAccept");
      expect(dropzone).toHaveTextContent("dragReject");
    });

    it("sets {isDragActive, isDragAccept, isDragReject} if any files are rejected and {multiple} is false on dragenter", async () => {
      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          multiple={false}
        >
          {({
            getRootProps,
            getInputProps,
            isDragActive,
            isDragAccept,
            isDragReject,
          }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragActive() && "dragActive"}
              {isDragAccept() && "dragAccept"}
              {isDragReject() && "dragReject"}
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, createDtWithFiles(images));

      expect(dropzone).toHaveTextContent("dragActive");
      expect(dropzone).not.toHaveTextContent("dragAccept");
      expect(dropzone).toHaveTextContent("dragReject");
    });

    it("keeps {isDragActive} if dragleave is triggered for some arbitrary node", async () => {
      const { container: overlayContainer } = render(() => <div />);

      const { container } = render(() => (
        <Dropzone>
          {({
            getRootProps,
            getInputProps,
            isDragActive,
            isDragAccept,
            isDragReject,
          }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragActive() && "dragActive"}
              {isDragAccept() && "dragAccept"}
              {isDragReject() && "dragReject"}
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.dragEnter(dropzone, createDtWithFiles(files));

      fireEvent.dragLeave(dropzone, {
        bubbles: true,
        target: overlayContainer.querySelector("div"),
      });

      expect(dropzone).toHaveTextContent("dragActive");
    });

    // it("resets {isDragActive, isDragAccept, isDragReject} on dragleave", async () => {
    //   const { container } = render(() => (
    //     <Dropzone
    //       accept={{
    //         "image/*": [],
    //       }}
    //     >
    //       {({
    //         getRootProps,
    //         getInputProps,
    //         isDragActive,
    //         isDragAccept,
    //         isDragReject,
    //       }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isDragActive() && "dragActive"}
    //           {isDragAccept() && "dragAccept"}
    //           {isDragReject() && "dragReject"}
    //           {!isDragActive && (
    //             <span
    //               id="child"
    //               data-accept={isDragAccept}
    //               data-reject={isDragReject}
    //             />
    //           )}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));
    //   const dropzone = container.querySelector("div");
    //   if (!dropzone) throw new Error("dropzone element not found");

    //   const data = createDtWithFiles(images);
    //   const childElement = container.querySelector("#child")
    //   if (!childElement) throw new Error("child element not found");

    //   fireEvent.dragEnter(childElement, data)
    //   fireEvent.dragEnter(dropzone, data);
    //   fireEvent.dragEnter(dropzone, data);

    //   expect(dropzone).toHaveTextContent("dragActive");
    //   expect(dropzone).toHaveTextContent("dragAccept");
    //   expect(dropzone).not.toHaveTextContent("dragReject");

    //   fireEvent.dragLeave(dropzone, data);
    //   expect(dropzone).toHaveTextContent("dragActive");
    //   expect(dropzone).toHaveTextContent("dragAccept");
    //   expect(dropzone).not.toHaveTextContent("dragReject");

    //   fireEvent.dragLeave(dropzone, data);
    //   expect(dropzone).not.toHaveTextContent("dragActive");
    //   expect(dropzone).not.toHaveTextContent("dragAccept");
    //   expect(dropzone).not.toHaveTextContent("dragReject");

    //   const child = container.querySelector("#child");
    //   expect(child).toHaveAttribute("data-accept", "false");
    //   expect(child).toHaveAttribute("data-reject", "false");
    // });
  });

  describe("onDrop", () => {
    test("callback is invoked when <input> change event occurs", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone onDrop={onDropSpy}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const input = container.querySelector("input");
      if (!input) throw new Error("input element not found");
      
      fireEvent.change(input, {
        target: { files },
      })

      expect(onDropSpy).toHaveBeenCalledWith(files, [], expect.anything());
    });

    // it("sets {acceptedFiles, fileRejections, isDragReject}", async () => {
    //   const FileList = ({ files = [] }) => (
    //     <ul>
    //       {files.map((file) => (
    //         <li key={file.name} data-type={"accepted"}>
    //           {file.name}
    //         </li>
    //       ))}
    //     </ul>
    //   );

    //   const RejectedFileList = ({ fileRejections = [] }) => (
    //     <ul>
    //       {fileRejections.map(({ file, errors }) => (
    //         <li key={file.name}>
    //           <span data-type={"rejected"}>{file.name}</span>
    //           <ul>
    //             {errors.map((e) => (
    //               <li key={e.code} data-type={"error"}>
    //                 {e.code}
    //               </li>
    //             ))}
    //           </ul>
    //         </li>
    //       ))}
    //     </ul>
    //   );

    //   const getAcceptedFiles = (node) =>
    //     node.querySelectorAll(`[data-type="accepted"]`);
    //   const getRejectedFiles = (node) =>
    //     node.querySelectorAll(`[data-type="rejected"]`);
    //   const getRejectedFilesErrors = (node) =>
    //     node.querySelectorAll(`[data-type="error"]`);

    //   const matchToFiles = (fileList, files) =>
    //     Array.from(fileList).every(
    //       (item) => !!files.find((file) => file.name === item.textContent)
    //     );
    //   const matchToErrorCode = (errorList, code) =>
    //     Array.from(errorList).every((item) => item.textContent === code);

    //   const { container } = render(() => (
    //     <Dropzone
    //       accept={{
    //         "image/*": [],
    //       }}
    //     >
    //       {({
    //         getRootProps,
    //         getInputProps,
    //         acceptedFiles,
    //         fileRejections,
    //         isDragReject,
    //       }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           <FileList files={acceptedFiles()} />
    //           <RejectedFileList fileRejections={fileRejections()} />
    //           {isDragReject() && "dragReject"}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));
    //   const dropzone = container.querySelector("div");

    //   fireEvent.drop(dropzone, createDtWithFiles(images));

    //   const acceptedFileList = getAcceptedFiles(dropzone);
    //   expect(acceptedFileList).toHaveLength(images.length);
    //   expect(matchToFiles(acceptedFileList, images)).toBe(true);
    //   expect(dropzone).not.toHaveTextContent("dragReject");

    //   fireEvent.drop(dropzone, createDtWithFiles(files));

    //   const rejectedFileList = getRejectedFiles(dropzone);
    //   expect(rejectedFileList).toHaveLength(files.length);
    //   expect(matchToFiles(rejectedFileList, files)).toBe(true);
    //   const rejectedFileErrorList = getRejectedFilesErrors(dropzone);
    //   expect(rejectedFileErrorList).toHaveLength(files.length);
    //   expect(matchToErrorCode(rejectedFileErrorList, "file-invalid-type")).toBe(
    //     true
    //   );
    //   expect(dropzone).toHaveTextContent("dragReject");
    // });

    it("resets {isDragActive, isDragAccept, isDragReject}", async () => {
      const { container } = render(() => (
        <Dropzone>
          {({
            getRootProps,
            getInputProps,
            isDragActive,
            isDragAccept,
            isDragReject,
          }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragActive() && "dragActive"}
              {isDragAccept() && "dragAccept"}
              {isDragReject() && "dragReject"}
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      const data = createDtWithFiles(files);

      fireEvent.dragEnter(dropzone, data);

      expect(dropzone).toHaveTextContent("dragActive");
      expect(dropzone).toHaveTextContent("dragAccept");
      expect(dropzone).not.toHaveTextContent("dragReject");

      fireEvent.drop(dropzone, data);

      expect(dropzone).not.toHaveTextContent("dragActive");
      expect(dropzone).not.toHaveTextContent("dragAccept");
      expect(dropzone).not.toHaveTextContent("dragReject");
    });

    it("rejects all files if {multiple} is false and {accept} criteria is not met", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDrop={onDropSpy}
          multiple={false}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(files));

      expect(onDropSpy).toHaveBeenCalledWith(
        [],
        [
          {
            file: files[0],
            errors: [
              {
                code: "file-invalid-type",
                message: "File type must be image/*",
              },
            ],
          },
        ],
        expect.anything()
      );
    });

    it("rejects all files if {multiple} is false and {accept} criteria is met", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDrop={onDropSpy}
          multiple={false}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(images));

      expect(onDropSpy).toHaveBeenCalledWith(
        [],
        [
          {
            file: images[0],
            errors: [
              {
                code: "too-many-files",
                message: "Too many files",
              },
            ],
          },
          {
            file: images[1],
            errors: [
              {
                code: "too-many-files",
                message: "Too many files",
              },
            ],
          },
        ],
        expect.anything()
      );
    });

    it("rejects all files if {multiple} is true and maxFiles is less than files and {accept} criteria is met", async () => {
      const onDropSpy = vi.fn();
      const onDropRejectedSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDrop={onDropSpy}
          onDropRejected={onDropRejectedSpy}
          multiple={true}
          maxFiles={1}
        >
          {({ getRootProps, getInputProps, isDragReject, isDragAccept }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragReject() && "dragReject"}
              {isDragAccept() && "dragAccept"}
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(images));

      expect(onDropRejectedSpy).toHaveBeenCalled();

      fireEvent.dragEnter(dropzone, createDtWithFiles(images));

      expect(dropzone).toHaveTextContent("dragReject");
      expect(dropzone).not.toHaveTextContent("dragAccept");
      expect(onDropSpy).toHaveBeenCalledWith(
        [],
        [
          {
            file: images[0],
            errors: [
              {
                code: "too-many-files",
                message: "Too many files",
              },
            ],
          },
          {
            file: images[1],
            errors: [
              {
                code: "too-many-files",
                message: "Too many files",
              },
            ],
          },
        ],
        expect.anything()
      );
    });

    it("rejects all files if {multiple} is true and maxFiles has been updated so that it is less than files", async () => {
      const onDropSpy = vi.fn();
      const onDropRejectedSpy = vi.fn();

      const [maxFiles, setMaxFiles] = createSignal(3);

      const DropzoneComponent = () => (
        <Dropzone
          accept={{ "image/*": [] }}
          onDrop={onDropSpy}
          onDropRejected={onDropRejectedSpy}
          multiple
          maxFiles={maxFiles()}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.drop(dropzone, createDtWithFiles(images));
      expect(onDropRejectedSpy).not.toHaveBeenCalled();
      expect(onDropSpy).toHaveBeenCalledWith(images, [], expect.anything());

      setMaxFiles(1);

      fireEvent.drop(dropzone, createDtWithFiles(images));
      expect(onDropRejectedSpy).toHaveBeenCalledWith(
        expect.arrayContaining(
          images.map(img => expect.objectContaining({ file: img, errors: expect.any(Array) }))
        ),
        expect.anything()
      );
    });

    it("accepts multiple files if {multiple} is true and {accept} criteria is met", async () => {
      const onDropSpy = vi.fn();
      const onDropRejectedSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDrop={onDropSpy}
          multiple={true}
          maxFiles={3}
          onDropRejected={onDropRejectedSpy}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(
        dropzone,
        createDtWithFiles(images)
      )

      expect(onDropRejectedSpy).not.toHaveBeenCalled();
      expect(onDropSpy).toHaveBeenCalledWith(images, [], expect.anything());
    });

    it("accepts a single files if {multiple} is false and {accept} criteria is met", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDrop={onDropSpy}
          multiple={false}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      const [image] = images;
      fireEvent.drop(
        dropzone,
        createDtWithFiles([image])
      )

      expect(onDropSpy).toHaveBeenCalledWith([image], [], expect.anything());
    });

    it("accepts all files if {multiple} is true", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone onDrop={onDropSpy}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(files))

      expect(onDropSpy).toHaveBeenCalledWith(files, [], expect.anything());
    });

    // it("resets {isFileDialogActive} state", async () => {
    //   const onDropSpy = vi.fn();
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;

    //   const { container } = render(() => (
    //     <Dropzone onDrop={onDropSpy}>
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);

    //   //await act(() => fireEvent.drop(dropzone, createDtWithFiles(files)));

    //   expect(activeRef.current).toBeNull();
    //   expect(dropzone).not.toContainElement(activeRef.current);
    // });

    it("gets invoked with both accepted/rejected files", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDrop={onDropSpy}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(files));

      expect(onDropSpy).toHaveBeenCalledWith(
        [],
        [
          {
            file: files[0],
            errors: [
              {
                code: "file-invalid-type",
                message: "File type must be image/*",
              },
            ],
          },
        ],
        expect.anything()
      );
      onDropSpy.mockClear();

      fireEvent.drop(dropzone, createDtWithFiles(images));

      expect(onDropSpy).toHaveBeenCalledWith(images, [], expect.anything());
      onDropSpy.mockClear();

      fireEvent.drop(dropzone, createDtWithFiles([...files, ...images]))

      expect(onDropSpy).toHaveBeenCalledWith(
        images,
        [
          {
            file: files[0],
            errors: [
              {
                code: "file-invalid-type",
                message: "File type must be image/*",
              },
            ],
          },
        ],
        expect.anything()
      );
    });

    test("onDropAccepted callback is invoked if some files are accepted", async () => {
      const onDropAcceptedSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDropAccepted={onDropAcceptedSpy}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(files))
      expect(onDropAcceptedSpy).not.toHaveBeenCalled();
      onDropAcceptedSpy.mockClear();

      fireEvent.drop(dropzone, createDtWithFiles(images))

      expect(onDropAcceptedSpy).toHaveBeenCalledWith(images, expect.anything());
      onDropAcceptedSpy.mockClear();

      fireEvent.drop(dropzone, createDtWithFiles([...files, ...images]))

      expect(onDropAcceptedSpy).toHaveBeenCalledWith(images, expect.anything());
    });

    test("onDropRejected callback is invoked if some files are rejected", async () => {
      const onDropRejectedSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDropRejected={onDropRejectedSpy}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(files));

      expect(onDropRejectedSpy).toHaveBeenCalledWith(
        [
          {
            file: files[0],
            errors: [
              {
                code: "file-invalid-type",
                message: "File type must be image/*",
              },
            ],
          },
        ],
        expect.anything()
      );
      onDropRejectedSpy.mockClear();

      fireEvent.drop(dropzone, createDtWithFiles(images));

      expect(onDropRejectedSpy).not.toHaveBeenCalled();
      onDropRejectedSpy.mockClear();

      fireEvent.drop(dropzone, createDtWithFiles([...files, ...images]))

      expect(onDropRejectedSpy).toHaveBeenCalledWith(
        [
          {
            file: files[0],
            errors: [
              {
                code: "file-invalid-type",
                message: "File type must be image/*",
              },
            ],
          },
        ],
        expect.anything()
      );
    });

    it("accepts a dropped image when Firefox provides a bogus file type", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone
          accept={{
            "image/*": [],
          }}
          onDrop={onDropSpy}
        >
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      const images = [createFile("bogus.gif", 1234, "application/x-moz-file")];
      fireEvent.drop(
        dropzone,
        createDtWithFiles(images)
      );

      expect(onDropSpy).toHaveBeenCalledWith(images, [], expect.anything());
    });

    it("filters files according to {maxSize}", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone onDrop={onDropSpy} maxSize={1111}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(
        dropzone,
        createDtWithFiles(images)
      );

      expect(onDropSpy).toHaveBeenCalledWith(
        [],
        [
          {
            file: images[0],
            errors: [
              {
                code: "file-too-large",
                message: "File is larger than 1111 bytes",
              },
            ],
          },
          {
            file: images[1],
            errors: [
              {
                code: "file-too-large",
                message: "File is larger than 1111 bytes",
              },
            ],
          },
        ],
        expect.anything()
      );
    });

    it("filters files according to {minSize}", async () => {
      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone onDrop={onDropSpy} minSize={1112}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.drop(dropzone, createDtWithFiles(files));

      expect(onDropSpy).toHaveBeenCalledWith(
        [],
        [
          {
            file: files[0],
            errors: [
              {
                code: "file-too-small",
                message: "File is smaller than 1112 bytes",
              },
            ],
          },
        ],
        expect.anything()
      );
    });
  });

  describe("onFileDialogCancel", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("is not invoked every time window receives focus", () => {
      const onFileDialogCancelSpy = vi.fn();

      render(() => (
        <Dropzone onFileDialogCancel={onFileDialogCancelSpy}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      focusWindow();

      expect(onFileDialogCancelSpy).not.toHaveBeenCalled();
    });

    // it("resets {isFileDialogActive}", () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const onFileDialogCancelSpy = vi.fn();

    //   const { container } = render(() => (
    //     <Dropzone onFileDialogCancel={onFileDialogCancelSpy}>
    //       {({ getRootProps, getInputProps, isFileDialogActive }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   const dropzone = container.querySelector("div");

    //   fireEvent.click(dropzone);

    //   expect(activeRef.current).not.toBeNull();
    //   expect(dropzone).toContainElement(activeRef.current);

    //   focusWindow();

    //   expect(onFileDialogCancelSpy).toHaveBeenCalled();
    //   expect(dropzone).not.toContainElement(activeRef.current);
    // });

    it("is not invoked if <input> is not rendered", () => {
      const onFileDialogCancelSpy = vi.fn();

      const [showInput, setShowInput] = createSignal(true);

      const DropzoneComponent = () => (
        <Dropzone onFileDialogCancel={onFileDialogCancelSpy}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              {showInput() && <input {...getInputProps()} />}
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(DropzoneComponent);
      const dropzone = container.querySelector("div")!;

      fireEvent.click(dropzone);

      setShowInput(false);

      focusWindow();
      expect(onFileDialogCancelSpy).not.toHaveBeenCalled();
    });


    it("is not invoked if files were selected", async () => {
      const onFileDialogCancelSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone onFileDialogCancel={onFileDialogCancelSpy}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));

      const input = container.querySelector("input")
      if (!input) throw new Error("input element not found");

      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.change(input, {
        target: { files },
      })
      fireEvent.click(dropzone);

      focusWindow();

      expect(onFileDialogCancelSpy).not.toHaveBeenCalled();
    });

    it("does not throw if callback is not provided", () => {
      const { container } = render(() => (
        <Dropzone onFileDialogCancel={undefined}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
            </div>
          )}
        </Dropzone>
      ));
      
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("dropzone element not found");

      fireEvent.click(dropzone);

      const fn = () => {
        focusWindow();
      };
      expect(fn).not.toThrow();
    });
  });

  describe("onFileDialogOpen", () => {
    // it("is invoked when opening the file dialog", () => {
    //   const onFileDialogOpenSpy = vi.fn();
    //   const { container } = render(() => (
    //     <Dropzone onFileDialogOpen={onFileDialogOpenSpy}>
    //       {({ getRootProps, getInputProps }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   fireEvent.click(container.querySelector("div"));

    //   expect(onFileDialogOpenSpy).toHaveBeenCalled();
    // });

    it("is invoked when opening the file dialog programmatically", () => {
      const onFileDialogOpenSpy = vi.fn();
      const { container } = render(() => (
        <Dropzone onFileDialogOpen={onFileDialogOpenSpy}>
          {({ getRootProps, getInputProps, open }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button type="button" onClick={open}>
                Open
              </button>
            </div>
          )}
        </Dropzone>
      ));

      const button = container.querySelector("button");
      if (!button) throw new Error("button element not found");

      fireEvent.click(button);

      expect(onFileDialogOpenSpy).toHaveBeenCalled();
    });
  });

  describe("{open}", () => {
    it("can open file dialog programmatically", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, getInputProps, open }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button type="button" onClick={open}>
                Open
              </button>
            </div>
          )}
        </Dropzone>
      ));

      const button = container.querySelector("button");
      if (!button) throw new Error("button element not found");

      fireEvent.click(button);

      expect(onClickSpy).toHaveBeenCalled();
    });

    // it("sets {isFileDialogActive} state", () => {
    //   const activeRef = createRef();
    //   const active = <span ref={activeRef}>I am active</span>;
    //   const { container } = render(() => (
    //     <Dropzone>
    //       {({ getRootProps, getInputProps, isFileDialogActive, open }) => (
    //         <div {...getRootProps()}>
    //           <input {...getInputProps()} />
    //           {isFileDialogActive && active}
    //           <button type="button" onClick={open}>
    //             Open
    //           </button>
    //         </div>
    //       )}
    //     </Dropzone>
    //   ));

    //   fireEvent.click(container.querySelector("button"));

    //   expect(activeRef.current).not.toBeNull();
    //   expect(container.querySelector("div")).toContainElement(
    //     activeRef.current
    //   );
    // });

    it("does nothing if {disabled} is true", () => {
      const onClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
      const { container } = render(() => (
        <Dropzone disabled>
          {({ getRootProps, getInputProps, open }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button type="button" onClick={open}>
                Open
              </button>
            </div>
          )}
        </Dropzone>
      ));

      const button = container.querySelector("button");
      if (!button) throw new Error("button element not found");

      fireEvent.click(button);

      expect(onClickSpy).not.toHaveBeenCalled();
    });

    it("does not throw if <input> is missing", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps, open }) => (
            <div {...getRootProps()}>
              <button type="button" onClick={open}>
                Open
              </button>
            </div>
          )}
        </Dropzone>
      ));

      const button = container.querySelector("button");
      if (!button) throw new Error("button element not found");

      const fn = () => fireEvent.click(button);
      expect(fn).not.toThrow();
    });
  });

  describe("validator", () => {
    it("rejects with custom error", async () => {
      const validator = (file: File) => {
        if (/dogs/i.test(file.name))
          return { code: "dogs-not-allowed", message: "Dogs not allowed" };

        return null;
      };

      const onDropSpy = vi.fn();

      const { container } = render(() => (
        <Dropzone validator={validator} onDrop={onDropSpy} multiple={true}>
          {({ getRootProps }) => <div {...getRootProps()} />}
        </Dropzone>
      ));


      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("Dropzone element not found");

      fireEvent.drop(
        dropzone,
        createDtWithFiles(images)
      )

      expect(onDropSpy).toHaveBeenCalledWith(
        [images[0]],
        [
          {
            file: images[1],
            errors: [
              {
                code: "dogs-not-allowed",
                message: "Dogs not allowed",
              },
            ],
          },
        ],
        expect.anything()
      );
    });

    it("sets {isDragAccept, isDragReject}", async () => {
      const data = createDtWithFiles(images);
      const validator = () => ({
        code: "not-allowed",
        message: "Cannot do this!",
      });

      const ui = (
        <Dropzone validator={validator} multiple={true}>
          {({ getRootProps, getInputProps, isDragAccept, isDragReject }) => (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragAccept() && "dragAccept"}
              {isDragReject() && "dragReject"}
            </div>
          )}
        </Dropzone>
      );

      const { container } = render(() => ui);
      const dropzone = container.querySelector("div");
      if (!dropzone) throw new Error("Dropzone element not found");

      fireEvent.dragEnter(dropzone, data);

      expect(dropzone).not.toHaveTextContent("dragAccept");
      expect(dropzone).toHaveTextContent("dragReject");
    });
  });

  describe("accessibility", () => {
    it("sets the role attribute to button by default on the root", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps }) => <div id="root" {...getRootProps()} />}
        </Dropzone>
      ));

      expect(container.querySelector("#root")).toHaveAttribute(
        "role",
        "presentation"
      );
    });

    test("users can override the default role attribute on the root", () => {
      const { container } = render(() => (
        <Dropzone>
          {({ getRootProps }) => (
            <div id="root" {...getRootProps({ role: "generic" })} />
          )}
        </Dropzone>
      ));

      expect(container.querySelector("#root")).toHaveAttribute(
        "role",
        "generic"
      );
    });
  });
});

/**
 * focusWindow triggers focus on the window
 */
function focusWindow() {
  return fireEvent.focus(document.body, { bubbles: true });
}

/**
 * createFileSystemFileHandle creates a mock [FileSystemFileHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle)
 */
function createFileSystemFileHandle(file: File) {
  return { getFile: () => Promise.resolve(file) };
}

function createFile(name: string, size: number, type: string) {
  const file = new File([], name, { type });
  Object.defineProperty(file, "size", {
    get() {
      return size;
    },
  });
  return file;
}

/**
 * createThenable creates a Promise that can be controlled from outside its inner scope
 */
function createThenable() {
  let done, cancel;

  const promise = new Promise((resolve, reject) => {
    done = resolve;
    cancel = reject;
  });

  return {
    promise,
    done,
    cancel,
  };
}