import React from 'react';
import { Pagination as AntdPagination } from 'antd';
import type { PaginationProps } from 'antd/lib/pagination';

interface SEPaginationProps extends PaginationProps {}

const SEPagination: React.FC<SEPaginationProps> = ({ ...paginationProps }) => {
  return <AntdPagination {...paginationProps} />;
};

export default SEPagination;
