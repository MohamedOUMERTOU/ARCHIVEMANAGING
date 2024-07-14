import React from 'react';
import { Calendar } from 'antd';
import type { CalendarProps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

interface SECalendarProps extends Omit<CalendarProps<Dayjs>, 'onChange'> {
  className?: string;
  onChange?: (value: Dayjs | null) => void; // Adjust onChange type if necessary
}

const SECalendar: React.FC<SECalendarProps> = ({
  className = "",
  onChange,
  ...restProps
}) => {

  const handleChange = (value: Dayjs | null) => {
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <Calendar
      className={`se-calendar ${className}`}
      onChange={handleChange}
      {...restProps}
    />
  );
};

export default SECalendar;
