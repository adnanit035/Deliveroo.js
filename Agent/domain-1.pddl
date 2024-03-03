;; domain file: domain-deliveroo-1.pddl
(define (domain default)
    (:requirements :strips)

    (:predicates
        (AGENT ?x)
        (PKG ?x)
        (TILE ?x)
        (onTile ?x ?y)
        (downNeighbour ?x ?y)
        (upNeighbour ?x ?y)
        (rightNeighbour ?x ?y)
        (leftNeighbour ?x ?y)
        (free ?x)
        (picked ?x)
        (notPicked ?x)
        (isDeliverySpot ?x)
    )

    (:action right
    :parameters (?agent ?from ?to)
    :precondition (and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (rightNeighbour ?to ?from))
    :effect (and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from)))
)
        (:action left
    :parameters (?agent ?from ?to)
    :precondition (and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (leftNeighbour ?to ?from))
    :effect (and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from)))
)
        (:action up
    :parameters (?agent ?from ?to)
    :precondition (and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (upNeighbour ?to ?from))
    :effect (and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from)))
)
        (:action down
    :parameters (?agent ?from ?to)
    :precondition (and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (downNeighbour ?to ?from))
    :effect (and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from)))
)
        (:action pick_up
    :parameters (?agent ?pkg ?tile)
    :precondition (and (AGENT ?agent) (PKG ?pkg) (TILE ?tile) (onTile ?agent ?tile) (onTile ?pkg ?tile) (notPicked ?pkg))
    :effect (and (not (onTile ?pkg ?tile)) (not (notPicked ?pkg)) (picked ?pkg))
)
        (:action put_down
    :parameters (?agent ?pkg ?tile)
    :precondition (and (AGENT ?agent) (PKG ?pkg) (TILE ?tile) (onTile ?agent ?tile) (picked ?pkg) (isDeliverySpot ?tile))
    :effect (and (onTile ?pkg ?tile) (notPicked ?pkg) (not (picked ?pkg)))
)
        (:action wait
    :parameters (?agent ?from)
    :precondition (and (AGENT ?agent) (TILE ?from) (onTile ?agent ?from))
    :effect (and (onTile ?agent ?from))
)
)