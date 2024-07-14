import { message } from 'antd';

const SEMessage = {
  success: (content: string, duration: number = 3) => {
    message.success(content, duration);
  },
  info: (content: string, duration: number = 3) => {
    message.info(content, duration);
  },
  warning: (content: string, duration: number = 3) => {
    message.warning(content, duration);
  },
  error: (content: string, duration: number = 3) => {
    message.error(content, duration);
  }
};

export default SEMessage;
