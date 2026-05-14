// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ElectionSystem {
    struct Candidate {
        string name;
        string statement;
        string post;
        uint256 voteCount;
        address wallet;
        bool approved;
    }

    struct Election {
        string title;
        string description;
        bool isActive;
        string status; // "nomination", "ongoing", "ended"
        uint256 nominationEndDate;
        uint256[] voterBatches;
        uint256[] candidateBatches;
        string[] posts;
        uint256 candidatesCount;
        mapping(uint256 => Candidate) candidates;
        mapping(address => mapping(string => bool)) hasVoted; // voter => post => voted
    }

    address public admin;
    uint256 public electionsCount;
    mapping(uint256 => Election) public elections;

    event ElectionCreated(uint256 id, string title);
    event Nominated(uint256 electionId, uint256 candidateId, string name, string post);
    event CandidateApproved(uint256 electionId, uint256 candidateId);
    event VoteCast(uint256 electionId, address voter, uint256 candidateId, string post);
    event StatusUpdated(uint256 electionId, string status);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function createElection(
        string memory _title,
        string memory _description,
        string[] memory _posts,
        uint256[] memory _voterBatches,
        uint256[] memory _candidateBatches,
        uint256 _nominationEndDate
    ) public onlyAdmin {
        electionsCount++;
        Election storage newElection = elections[electionsCount];
        newElection.title = _title;
        newElection.description = _description;
        newElection.posts = _posts;
        newElection.voterBatches = _voterBatches;
        newElection.candidateBatches = _candidateBatches;
        newElection.nominationEndDate = _nominationEndDate;
        newElection.status = "nomination";
        newElection.isActive = true;

        emit ElectionCreated(electionsCount, _title);
    }

    function nominate(
        uint256 _electionId,
        string memory _name,
        string memory _statement,
        string memory _post
    ) public {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election not active");
        require(keccak256(abi.encodePacked(election.status)) == keccak256(abi.encodePacked("nomination")), "Not in nomination phase");
        
        election.candidatesCount++;
        Candidate storage c = election.candidates[election.candidatesCount];
        c.name = _name;
        c.statement = _statement;
        c.post = _post;
        c.wallet = msg.sender;
        c.approved = false;

        emit Nominated(_electionId, election.candidatesCount, _name, _post);
    }

    function approveCandidate(uint256 _electionId, uint256 _candidateId) public onlyAdmin {
        Election storage election = elections[_electionId];
        election.candidates[_candidateId].approved = true;
        emit CandidateApproved(_electionId, _candidateId);
    }

    function updateStatus(uint256 _electionId, string memory _status) public onlyAdmin {
        elections[_electionId].status = _status;
        emit StatusUpdated(_electionId, _status);
    }

    function vote(uint256 _electionId, uint256 _candidateId) public {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election not active");
        require(keccak256(abi.encodePacked(election.status)) == keccak256(abi.encodePacked("ongoing")), "Voting not live");
        
        Candidate storage candidate = election.candidates[_candidateId];
        require(candidate.approved, "Candidate not approved");
        
        require(!election.hasVoted[msg.sender][candidate.post], "Already voted for this post");

        candidate.voteCount++;
        election.hasVoted[msg.sender][candidate.post] = true;

        emit VoteCast(_electionId, msg.sender, _candidateId, candidate.post);
    }

    // Getters
    function getElectionBasics(uint256 _id) public view returns (
        string memory title, 
        string memory description, 
        string memory status, 
        uint256 candidatesCount
    ) {
        Election storage e = elections[_id];
        return (e.title, e.description, e.status, e.candidatesCount);
    }

    function getCandidate(uint256 _electionId, uint256 _candidateId) public view returns (
        string memory name,
        string memory statement,
        string memory post,
        uint256 voteCount,
        bool approved
    ) {
        Candidate storage c = elections[_electionId].candidates[_candidateId];
        return (c.name, c.statement, c.post, c.voteCount, c.approved);
    }

    function getElectionPosts(uint256 _id) public view returns (string[] memory) {
        return elections[_id].posts;
    }
}
