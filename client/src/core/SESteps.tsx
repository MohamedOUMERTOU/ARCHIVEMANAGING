import React from 'react';
import { Steps as AntdSteps } from 'antd';
import type { StepsProps } from 'antd/lib/steps';

interface SEStepsProps extends StepsProps {}

const SESteps: React.FC<SEStepsProps> = ({ ...stepsProps }) => {
  return <AntdSteps {...stepsProps} />;
};

export default SESteps;
