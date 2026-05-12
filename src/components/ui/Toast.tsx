"use client";

import { message as antdMessage } from "antd";

export const toast = {
  success: (content: string) => antdMessage.success(content),
  error: (content: string) => antdMessage.error(content),
  warning: (content: string) => antdMessage.warning(content),
  info: (content: string) => antdMessage.info(content),
  loading: (content: string, duration = 0) => antdMessage.loading(content, duration),
};
