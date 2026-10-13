/**
 * 兼容出口：对话页的状态装配已经搬到 `use-chat-session.ts`。
 *
 * 为什么搬：对话有两个入口——**对话页**（三栏壳）与**助手抽屉**（任意页 `Ctrl+/`）。
 * 两者的差异是壳，相同的是行为（新建会话、发一条、等回复、切会话、删会话）。
 * 旧版把行为写在 `use-chat-page.ts` 里且只服务对话页，抽屉要么整套抄一遍，
 * 要么拿一个形状不对的对象去糊弄 `ChatMessageList` 的 props。
 *
 * 现在分层是：
 *
 * - `use-chat-session.ts` 的 `useChatSession(channel)`：两个入口共用的行为；
 * - `use-chat-session.ts` 的 `useChatPage(channel)`：在它之上补出会话列表与增删选。
 *
 * 本文件只做转发，避免出现两份定义。新代码请直接从 `../state/use-chat-session` 引入。
 */

export { useChatPage, useChatSession } from "./use-chat-session";
export type { ChatPageApi, ChatSessionApi } from "./use-chat-session";
