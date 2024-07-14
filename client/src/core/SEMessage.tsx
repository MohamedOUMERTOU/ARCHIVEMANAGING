import React from 'react';
import { message } from 'antd';

interface SEMessageProps {
  type: 'success' | 'info' | 'warning' | 'error';
  content: string;
  duration?: number;
}

const SEMessage: React.FC<SEMessageProps> = ({
  type,
  content,
  duration = 3, // Default duration in seconds
}) => {

  const showMessage = () => {
    switch (type) {
      case 'success':
        message.success(content, duration);
        break;
      case 'info':
        message.info(content, duration);
        break;
      case 'warning':
        message.warning(content, duration);
        break;
      case 'error':
        message.error(content, duration);
        break;
      default:
        break;
    }
  };

  // Immediately display the message when the component renders
  React.useEffect(() => {
    showMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SEMessage component doesn't render anything directly
  return null;
};

export default SEMessage;
