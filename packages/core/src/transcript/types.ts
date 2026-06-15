export interface TextItemWithPosition {
  str: string;
  x: number;
  y: number;
}

export interface PdfPageText {
  pageText: string;
  itemsWithPosition: TextItemWithPosition[];
  hasPosition: boolean;
}
