import { useAtomValue } from 'jotai';

import { announcementAtom } from '~/store/announcer';

/**
 * 全局状态播报区。挂在应用根部、常驻 DOM（内容为空也要存在），
 * 这样切换节点 / 测速完成等消息才能被 NVDA 等读屏稳定播报。
 */
export function Announcer() {
  const announcement = useAtomValue(announcementAtom);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {announcement?.message ?? ''}
    </div>
  );
}
