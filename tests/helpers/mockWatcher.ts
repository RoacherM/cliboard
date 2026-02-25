import { EventEmitter } from 'node:events';

export class MockWatcher extends EventEmitter {
  closed = false;

  simulateFileAdd(filePath: string): void {
    this.emit('add', filePath);
  }

  simulateFileChange(filePath: string): void {
    this.emit('change', filePath);
  }

  simulateFileUnlink(filePath: string): void {
    this.emit('unlink', filePath);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.removeAllListeners();
  }
}
