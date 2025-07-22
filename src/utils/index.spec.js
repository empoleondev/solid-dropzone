import { describe, beforeEach, afterEach, vi } from 'vitest';

describe("utils", () => {
  /**
   * @constant
   * @type {import('./index')}
   */
  let utils;

  beforeEach(async () => {
    // We use dynamic imports here to allow us to jest.resetModules() and get a fresh
    // copy of the module in each test.
    utils = await import("./index");
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("fileAccepted()", () => {
    it("returns true for a file that is accepted", () => {
      const file = { type: "image/jpeg" };
      const accept = "image/jpeg";
      expect(utils.fileAccepted(file, accept)[0]).toBe(true);
    });

    it("returns false for a file that is not accepted", () => {
      const file = { type: "image/jpeg" };
      const accept = "image/png";
      expect(utils.fileAccepted(file, accept)[0]).toBe(false);
    });

    it("returns a specific error for a file that is not accepted", () => {
      const file = { type: "image/jpeg" };
      const accept = "image/png";
      const [, error] = utils.fileAccepted(file, accept);
      expect(error.code).toBe(utils.ErrorCode.FileInvalidType);
      expect(error.message).toBe(`File type must be ${accept}`);
    });
  });

  describe("fileMatchSize()", () => {
    it("should return true if the file object doesn't have a {size} property", () => {
      expect(utils.fileMatchSize({})).toEqual([true, null]);
      expect(utils.fileMatchSize({ size: null })).toEqual([true, null]);
    });

    it("returns true for a file that is within the size range", () => {
      const file = { size: 1000 };
      const minSize = 500;
      const maxSize = 1500;
      expect(utils.fileMatchSize(file, minSize, maxSize)[0]).toBe(true);
    });

    it("returns false for a file that is smaller than the min size", () => {
      const file = { size: 400 };
      const minSize = 500;
      expect(utils.fileMatchSize(file, minSize)[0]).toBe(false);
    });

    it("returns a specific error for a file that is smaller than the min size", () => {
      const file = { size: 400 };
      const minSize = 500;
      const [, error] = utils.fileMatchSize(file, minSize);
      expect(error.code).toBe(utils.ErrorCode.FileTooSmall);
      expect(error.message).toBe(`File is smaller than ${minSize} bytes`);
    });

    it("returns false for a file that is larger than the max size", () => {
      const file = { size: 2000 };
      const maxSize = 1500;
      expect(utils.fileMatchSize(file, undefined, maxSize)[0]).toBe(false);
    });

    it("returns a specific error for a file that is larger than the max size", () => {
      const file = { size: 2000 };
      const maxSize = 1500;
      const [, error] = utils.fileMatchSize(file, undefined, maxSize);
      expect(error.code).toBe(utils.ErrorCode.FileTooLarge);
      expect(error.message).toBe(`File is larger than ${maxSize} bytes`);
    });
  });

  describe('accepts', () => {
    it('should return true if no acceptedFiles', () => {
      const file = {
        name: 'me.jpeg',
        type: 'image/jpeg',
      }
      expect(utils.accepts(file, null)).toBe(true)
      expect(utils.accepts(file, undefined)).toBe(true)
    })
  })

  describe('allFilesAccepted()', () => {
    it('returns false if there are more files than maxFiles', () => {
      const files = [{}, {}];
      const maxFiles = 1;
      expect(utils.allFilesAccepted({ files, maxFiles, multiple: true })).toBe(false);
    });

    it('returns false if not multiple and more than one file', () => {
      const files = [{}, {}];
      const multiple = false;
      expect(utils.allFilesAccepted({ files, multiple })).toBe(false);
    });

    it('returns false if some files are not accepted', () => {
      const files = [{ name: 'a.txt' }, { name: 'b.jpeg' }];
      const accept = '.txt';
      expect(utils.allFilesAccepted({ files, accept })).toBe(false);
    });
  });

  describe("isIeOrEdge()", () => {
    it("should return true for IE11", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko";
      expect(utils.isIeOrEdge(ua)).toBe(true);
    });

    it("should return true for Edge", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299";
      expect(utils.isIeOrEdge(ua)).toBe(true);
    });
  });
});
