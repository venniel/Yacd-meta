import { atom, getDefaultStore } from 'jotai';

export type Announcement = {
  id: number;
  message: string;
};

/**
 * 供屏幕阅读器播报的状态消息。用自增 id 而不是纯字符串，保证同样的内容
 * 再次出现时 atom 也会变化，从而重新触发一次播报。
 */
export const announcementAtom = atom<Announcement | null>(null);

const store = getDefaultStore();
let seq = 0;

export function announce(message: string) {
  store.set(announcementAtom, { id: ++seq, message });
}
