import type { ConditionGrade } from '../../api/crate';

export interface FieldValues {
  conditionGrade: ConditionGrade | null;
  specialAttributes: string[];
  price: string;
  userNotes: string;
}

export const emptyFields: FieldValues = {
  conditionGrade: null,
  specialAttributes: [],
  price: '',
  userNotes: '',
};
