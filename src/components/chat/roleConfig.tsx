import { Avatar } from "antd";

export const AIAvatar = () => (
  <Avatar style={{ background: "#6366f1", color: "#fff", fontWeight: 700 }} size={36}>
    AI
  </Avatar>
);

export const UserAvatar = () => (
  <Avatar style={{ background: "#e2e8f0", color: "#475569" }} size={36}>
    面试者
  </Avatar>
);

export const roleConfig = {
  interviewer: {
    placement: "start" as const,
    avatar: <AIAvatar />,
    styles: { content: { background: "#f1f5f9", color: "#334155", borderRadius: 16 } },
  },
  user: {
    placement: "end" as const,
    avatar: <UserAvatar />,
    styles: { content: { background: "#22c55e", color: "#fff", borderRadius: 16 } },
  },
};
