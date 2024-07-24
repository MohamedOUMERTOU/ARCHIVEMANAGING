import type { SelectProps } from "antd";
import { Select, Spin } from "antd";
import React, { useEffect, useState } from "react";
import SECol from "./SECol";
import SETypography from "./SETypography";
import { SECore } from "../apis/SECore";

interface SESelectProps extends Omit<SelectProps<any>, "onChange"> {
  value?: string | number;
  onChange?: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  col?: number;
  name: string; // Add name prop for API endpoint
  label: string; // Add label prop for the label
}

const SESelect: React.FC<SESelectProps> = ({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  className = "",
  id,
  autoFocus,
  tabIndex,
  col = 24,
  name,
  label,
  ...restProps
}) => {
  const [options, setOptions] = useState<{ code: string | number; label: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true);
        // Fetch data from the API based on the name prop
        const data = await SECore.get<{ code: string | number; label: string }[]>(`/lov/${name}`);
        console.log("Data::",data);
        
        setOptions(data);
      } catch (error) {
        // Handle error
        console.error("Failed to fetch options", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [name]);

  return (
    <SECol span={col}>
      {label && <SETypography text={label} level={5} />} {/* Render label if label is provided */}
      <Select
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        className={`se-select ${className}`}
        {...restProps}
      >
        {loading ? (
          <Select.Option disabled>
            <Spin size="small" />
          </Select.Option>
        ) : (
          options.map((option) => (
            <Select.Option key={option.code} value={option.code}>
              {option.label}
            </Select.Option>
          ))
        )}
      </Select>
    </SECol>
  );
};

export default SESelect;
