export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type DrawerParamList = {
  Dashboard: undefined;
  Applications: undefined;
  AiMatch: { jobId?: string } | undefined;
  Resume: undefined;
  WarRoom: undefined;
  Learning: undefined;
  Analytics: undefined;
  Calendar: undefined;
  Profile: undefined;
  Settings: undefined;
};

// War Room gets its own nested stack since Test Room / System Design Solve are pushed "detail" screens that
// benefit from native back-gesture, unlike the other sections (which mirror the web app's actual architecture of
// "everything is local component state, no routing" - see apps/web research notes for Applications/Resume/AI
// Match/Learning Center, all confirmed to have zero URL-driven sub-navigation).
export type WarRoomStackParamList = {
  WarRoomHome: undefined;
  TemplateList: { testType: "aptitude" | "computer-science" | "ai"; roleId?: string; roleName?: string };
  TestRoom: { attemptId: string };
  SystemDesignList: undefined;
  SystemDesignSolve: { problemId: string };
  CodingGate: undefined;
};
