export const ELECTION_ABI = [
  "function electionsCount() view returns (uint256)",
  "function createElection(string _title, string _description, string[] _posts, uint256[] _voterBatches, uint256[] _candidateBatches, uint256 _nominationEndDate)",
  "function nominate(uint256 _electionId, string _name, string _statement, string _post)",
  "function approveCandidate(uint256 _electionId, uint256 _candidateId)",
  "function updateStatus(uint256 _electionId, string _status)",
  "function vote(uint256 _electionId, uint256 _candidateId)",
  "function getElectionBasics(uint256 _id) view returns (string title, string description, string status, uint256 candidatesCount)",
  "function getCandidate(uint256 _electionId, uint256 _candidateId) view returns (string name, string statement, string post, uint256 voteCount, bool approved)",
  "function getElectionPosts(uint256 _id) view returns (string[] memory)",
  "event ElectionCreated(uint256 id, string title)",
  "event Nominated(uint256 electionId, uint256 candidateId, string name, string post)",
  "event VoteCast(uint256 electionId, address voter, uint256 candidateId, string post)"
];

// After deploying to Ganache, update this address
export const CONTRACT_ADDRESS = "0x1fCce957F59D72871e3f4419e738F07b42380E7d";
