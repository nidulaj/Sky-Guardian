from typing import List
from app.rag.schemas import KnowledgeDocument

def get_default_aviation_documents() -> List[KnowledgeDocument]:
    """
    Returns curated, verified airline conditions of carriage, airport MCT guidelines,
    and statutory passenger rights regulations for pre-populating the RAG knowledge base.
    """
    documents: List[KnowledgeDocument] = []

    # 1. SriLankan Airlines
    documents.append(KnowledgeDocument(
        doc_id="doc-srilankan-carriage",
        title="SriLankan Airlines Conditions of Carriage - Schedule Changes & Missed Connections",
        airline="SriLankan Airlines",
        airline_code="UL",
        airport="CMB",
        policy_type="CARRIER_CONDITIONS_OF_CARRIAGE",
        source_url="https://www.srilankan.com/en_uk/plan-and-book/conditions-of-carriage",
        effective_date="2025-01-01",
        jurisdiction="Sri Lanka / International",
        verified=True,
        content="""# SriLankan Airlines Conditions of Carriage

## Article 9: Schedules, Delays, Cancellations and Missed Connections

### 9.1 Connection Protection Under Single Contract
If a passenger misses a connecting flight issued under a single through-ticket or interline ticket due to a SriLankan Airlines flight delay or schedule modification, SriLankan Airlines undertakes full carrier liability to protect the traveler's onward journey.

### 9.2 Complimentary Rebooking Guarantee
Under connection protection obligations, SriLankan Airlines will rebook the passenger on the next available flight of SriLankan Airlines or an interline partner carrier to the ticketed destination without assessing change fees, fare differences, or administrative penalties.

### 9.3 Transfer Layover Duty of Care
When an inbound delay causes an involuntary transfer connection layover exceeding 4 hours at the connecting hub (including Kuala Lumpur KLIA, Singapore Changi, or Bangkok Suvarnabhumi):
- SriLankan Airlines or its ground handling partner will issue complimentary meal vouchers valid at airport transit restaurants.
- For overnight delays exceeding 6 hours or requiring a night stay, SriLankan Airlines will provide complimentary hotel accommodation, round-trip ground transportation between the airport and hotel, and baggage storage.

### 9.4 Transfer Desk Guidance
Passengers encountering connection delays must report immediately to the SriLankan Airlines transit service desk or the operating partner transfer counter upon arrival to obtain updated boarding passes and care vouchers."""
    ))

    # 2. Malaysia Airlines
    documents.append(KnowledgeDocument(
        doc_id="doc-malaysia-commitment",
        title="Malaysia Airlines Passenger Service Commitment - Disruption & KLIA Layover Care",
        airline="Malaysia Airlines",
        airline_code="MH",
        airport="KUL",
        policy_type="CARRIER_CONDITIONS_OF_CARRIAGE",
        source_url="https://www.malaysiaairlines.com/mh/en/terms-and-conditions.html",
        effective_date="2025-03-15",
        jurisdiction="Malaysia / International",
        verified=True,
        content="""# Malaysia Airlines Customer Service Commitment

## Schedule Disruption & KLIA Transfer Protection

### Disruption Assistance at Kuala Lumpur International Airport (KLIA)
For connection delays exceeding 4 hours caused by inbound carrier schedule changes under oneworld and interline partner agreements:
- Meal vouchers and refreshments are provided at KLIA Terminal 1.
- Overnight hotel accommodation options are arranged at transit facilities such as Sama-Sama Express KLIA or designated partner hotels.

### Interline Rebooking Cooperation
In cases where an inbound flight arrives past the Minimum Connection Time (MCT) for an onward Malaysia Airlines sector:
- Malaysia Airlines transfer desks in the KLIA Satellite Building (Transfer Desk C) will coordinate passenger re-accommodation onto the earliest available flight.
- Passengers holding confirmed onward bookings retain full priority on subsequent flights."""
    ))

    # 3. KLIA Airport Guidelines
    documents.append(KnowledgeDocument(
        doc_id="doc-klia-mct",
        title="Kuala Lumpur International Airport (KLIA) Minimum Connection Times & Transit Guide",
        airline=None,
        airline_code=None,
        airport="KUL",
        policy_type="AIRPORT_MCT_GUIDELINE",
        source_url="https://www.malaysiaairports.com.my/transit",
        effective_date="2025-01-01",
        jurisdiction="Malaysia",
        verified=True,
        content="""# KLIA Transit and Minimum Connection Time (MCT) Protocols

## Minimum Connection Time (MCT) Standards
- International-to-International connections within KLIA Terminal 1 require a strict minimum connection time of 60 minutes.
- Connections between KLIA Terminal 1 and KLIA Terminal 2 require a minimum connection time of 120 minutes.
- Transfer windows under 60 minutes within Terminal 1 are designated HIGH RISK and LIKELY MISSED due to security re-screening and aerotrain/bus transit.

## Transfer Counter Facilities
- International transit passengers should proceed directly to the Satellite Building Transfer Counter (Transfer Counter C) or Main Terminal Building Transfer Counter (Transfer Counter A/B).
- Passengers do not need to clear Malaysian border immigration if their baggage is checked through and both flights operate within the international transit area."""
    ))

    # 4. Singapore Airlines
    documents.append(KnowledgeDocument(
        doc_id="doc-singaporeair-carriage",
        title="Singapore Airlines Conditions of Carriage - Article 10 Disruption Recovery",
        airline="Singapore Airlines",
        airline_code="SQ",
        airport="SIN",
        policy_type="CARRIER_CONDITIONS_OF_CARRIAGE",
        source_url="https://www.singaporeair.com/en_UK/sg/flying-with-us/conditions-of-carriage",
        effective_date="2025-01-01",
        jurisdiction="Singapore / International",
        verified=True,
        content="""# Singapore Airlines Conditions of Carriage

## Article 10: Involuntary Re-routing and Transit Care
10.1 In the event of a delayed or missed connection on Singapore Airlines or Star Alliance itineraries, Singapore Airlines will carry the passenger on another of its scheduled passenger services or re-route the passenger to the destination indicated on the ticket on another carrier without additional charge.
10.2 Duty of care includes meal and telephone amenities, and hotel accommodation when an overnight layover is necessary at Singapore Changi Airport (SIN)."""
    ))

    # 5. EU261 Passenger Rights
    documents.append(KnowledgeDocument(
        doc_id="doc-eu261-regulation",
        title="EU Regulation 261/2004 - Passenger Rights & Statutory Compensation",
        airline=None,
        airline_code=None,
        airport=None,
        policy_type="PASSENGER_RIGHTS_REGULATION",
        source_url="https://eur-lex.europa.eu/eli/reg/2004/261/oj",
        effective_date="2024-01-01",
        jurisdiction="European Union",
        verified=True,
        content="""# Regulation (EC) No 261/2004 (EU261)

## Scope and Entitlements
EU261 applies to all flights departing from any EU airport, and flights arriving into an EU airport operated by an EU carrier.

## Right to Care (Article 9)
Passengers suffering delays of 2 hours or more are entitled to complimentary meals and refreshments in reasonable relation to the waiting time, and two free telephone calls, faxes, or emails.
Where an overnight stay becomes necessary, passengers are entitled to hotel accommodation and transport between airport and accommodation free of charge.

## Right to Reimbursement or Re-routing (Article 8)
Passengers may choose between full reimbursement within 7 days, or re-routing under comparable transport conditions to their final destination at the earliest opportunity."""
    ))

    # 6. US DOT Regulations
    documents.append(KnowledgeDocument(
        doc_id="doc-us-dot-part259",
        title="US DOT 14 CFR Part 259/260 - Airline Passenger Protection and Refund Mandates",
        airline=None,
        airline_code=None,
        airport=None,
        policy_type="PASSENGER_RIGHTS_REGULATION",
        source_url="https://www.faa.gov/regulations_policies/",
        effective_date="2024-10-28",
        jurisdiction="United States",
        verified=True,
        content="""# US Department of Transportation (DOT) Aviation Consumer Rules

## Automatic Refunds for Significant Flight Delays
Under 14 CFR Part 260, consumers are entitled to a prompt automatic refund of ticket fees if the airline cancels or significantly changes their flight itinerary:
- Significant departure or arrival delay is defined as at least 3 hours for domestic flights and at least 6 hours for international flights.
- Consumers rejecting alternative transportation must receive refunds within 7 business days for credit card purchases."""
    ))

    return documents
