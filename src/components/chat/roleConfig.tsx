import { Avatar } from "antd";

export const AIAvatar = () => (
  <Avatar style={{ background: "#8b5cf6", color: "#fff", fontWeight: 700 }} size={36}>
    AI
  </Avatar>
);

export const UserAvatar = () => (
  <Avatar style={{ background: "#1e2640", color: "#94a3b8" }} size={36}>
    You
  </Avatar>
);

export const roleConfig = {
  interviewer: {
    placement: "start" as const,
    avatar: <AIAvatar />,
    styles: { content: { background: "#1e2640", color: "#f1f5f9", borderRadius: 16 } },
  },
  user: {
    placement: "end" as const,
    avatar: <UserAvatar />,
    styles: { content: { background: "#8b5cf6", color: "#fff", borderRadius: 16 } },
  },
};
