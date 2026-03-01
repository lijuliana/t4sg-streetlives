export type Service = {
  id: string;
  name: string;
  description: string;
  category: string;
};

export type Favorite = {
  id: string;
  user_id: string;
  service_id: string;
  created_at?: string;
};
