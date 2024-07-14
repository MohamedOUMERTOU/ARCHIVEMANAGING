import React ,{ MouseEvent }from 'react';
import { Switch } from 'antd';
import type { SwitchProps } from 'antd';


interface SESwitchProps extends Omit<SwitchProps, 'onChange'> {
  className?: string;
  onChange?: (checked: boolean, event: MouseEvent<HTMLButtonElement>) => void; // Use MouseEvent<HTMLButtonElement> for event type
}

const SESwitch: React.FC<SESwitchProps> = ({
  className = "",
  onChange,
  ...restProps
}) => {

  const handleChange = (checked: boolean, event: MouseEvent<HTMLButtonElement>) => {
    if (onChange) {
      onChange(checked, event);
    }
  };

  return (
    <Switch
      className={`se-switch ${className}`}
      onChange={handleChange}
      {...restProps}
    />
  );
};

export default SESwitch;
