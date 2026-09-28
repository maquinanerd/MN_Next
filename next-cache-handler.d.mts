import type FileSystemCache from 'next/dist/server/lib/incremental-cache/file-system-cache';

/** Next's FileSystemCache with run-time disk writes turned off (next-cache-handler.mjs). */
export default class MemoryOnlyCache extends FileSystemCache {}
