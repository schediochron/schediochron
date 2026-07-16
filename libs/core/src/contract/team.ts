export interface CreateTeamRequest {
  name: string; // 1–255 chars
}

export interface UpdateTeamRequest {
  name: string; // 1–255 chars
}

export interface AddTeamMemberRequest {
  userId: string; // UUID v4
}
