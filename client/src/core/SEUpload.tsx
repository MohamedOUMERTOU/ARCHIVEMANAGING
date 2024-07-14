import React from 'react';
import { Button, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

interface SEUploadProps extends UploadProps<File> {
  className?: string;
  id?: string;
}

const SEUpload: React.FC<SEUploadProps> = ({
  className = "",
  id,
  ...restProps
}) => {

  return (
    <Upload
      className={`se-upload ${className}`}
      id={id}
      {...restProps}
    >
      <Button icon={<UploadOutlined />}>Upload</Button>
    </Upload>
  );
};

export default SEUpload;
