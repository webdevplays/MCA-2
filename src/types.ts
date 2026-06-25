export interface User {
  id: string;
  username: string;
  role: string;
  fullName: string;
  email: string;
  avatar: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  type: "string" | "number" | "select" | "date" | "email";
  required?: boolean;
  readonly?: boolean;
  options?: string[];
}

export interface TableMetadata {
  key: string;
  displayName: string;
  description: string;
  icon: string;
  columns: ColumnDefinition[];
  rowCount: number;
}

export type TableRows = Record<string, any>[];

export interface DatabaseState {
  tables: Record<string, TableMetadata>;
  activeTableKey: string | null;
  activeRows: TableRows;
  loading: boolean;
  error: string | null;
}
