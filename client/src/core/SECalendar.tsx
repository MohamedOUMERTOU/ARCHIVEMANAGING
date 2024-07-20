import type { CalendarProps } from 'antd';
import { Calendar } from 'antd';
import { Dayjs } from 'dayjs';
import React from 'react';
import SECol from './SECol';

interface SECalendarProps extends Omit<CalendarProps<Dayjs>, 'onChange'> {
  className?: string;
  onChange?: (value: Dayjs | null) => void; // Adjust onChange type if necessary
  col?:number
}

const SECalendar: React.FC<SECalendarProps> = ({
  className = "",
  onChange,
  col=24,
  ...restProps
}) => {

  const handleChange = (value: Dayjs | null) => {
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <SECol span={col}>
       <Calendar
      className={`se-calendar ${className}`}
      onChange={handleChange}
      {...restProps}
    />
    </SECol>
   
  );
};

export default SECalendar;
