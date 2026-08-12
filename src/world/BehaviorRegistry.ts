import type { ItemDef } from '../items/ItemRegistry';
import type {
  BlockDef,
  BlockFacing,
  BlockMetadata,
  BlockState,
  BlockStateProperties,
  ItemStack,
} from '../types';

export interface BlockPosition {
  x: number;
  y: number;
  z: number;
}

export interface WorldContext {
  dimension: number;
  getBlock(position: BlockPosition): number;
  getBlockState(position: BlockPosition): BlockState | undefined;
  getBlockMetadata(position: BlockPosition): BlockMetadata | undefined;
  setBlock(position: BlockPosition, blockId: number): void;
  setBlockStateProperties(position: BlockPosition, properties: BlockStateProperties): void;
  setBlockMetadata(position: BlockPosition, metadata: BlockMetadata | null): void;
  scheduleTick(position: BlockPosition, delayTicks: number, reason: string): void;
}

export interface LootContext {
  world: WorldContext;
  position: BlockPosition;
  block: BlockDef;
  tool?: ItemStack;
  fortuneLevel?: number;
  silkTouch?: boolean;
  exploded?: boolean;
  random(): number;
}

export interface BlockInteractionContext {
  position: BlockPosition;
  face?: BlockFacing;
  blockId: number;
  block: BlockDef;
  heldItem: ItemStack | null;
}

export interface ItemInteractionContext {
  item: ItemDef;
  stack: ItemStack;
  target?: BlockInteractionContext;
}

export interface EntityInteractionContext<TTarget = unknown> {
  target: TTarget;
  heldItem: ItemStack | null;
}

export interface BehaviorResult {
  handled: boolean;
  cooldown?: number;
  completed?: boolean;
}

export type ItemUseStopReason = 'released' | 'switched' | 'blocked' | 'cancelled' | 'completed';

export interface ItemUseProgress {
  deltaSeconds: number;
  elapsedSeconds: number;
}

export interface ItemUseStop extends ItemUseProgress {
  reason: ItemUseStopReason;
  stillSelected: boolean;
}

export interface BlockBehavior<TContext extends BlockInteractionContext = BlockInteractionContext> {
  id: string;
  interact?(context: TContext): BehaviorResult;
  preventsItemUse?: boolean | ((context: TContext) => boolean);
  scheduledTick?(world: WorldContext, position: BlockPosition, reason: string): void;
  getDrops?(context: LootContext): ItemStack[];
}

export interface ItemBehavior<TContext extends ItemInteractionContext = ItemInteractionContext> {
  id: string;
  use?(context: TContext): BehaviorResult;
  canStartUse?(context: TContext): boolean;
  startUse?(context: TContext): BehaviorResult;
  continueUse?(context: TContext, progress: ItemUseProgress): BehaviorResult;
  stopUse?(context: TContext, progress: ItemUseStop): BehaviorResult;
}

export interface EntityBehavior<TContext extends EntityInteractionContext = EntityInteractionContext> {
  id: string;
  interact?(context: TContext): BehaviorResult;
}

/**
 * Central dispatch for block, item, and entity behavior. Aliases are registry
 * names; explicit BlockDef/ItemDef behaviorId values take precedence for data packs.
 */
export class BehaviorRegistry<
  TBlockContext extends BlockInteractionContext = BlockInteractionContext,
  TItemContext extends ItemInteractionContext = ItemInteractionContext,
  TEntityContext extends EntityInteractionContext = EntityInteractionContext,
> {
  private readonly blockBehaviors = new Map<string, BlockBehavior<TBlockContext>>();
  private readonly blockAliases = new Map<string, string>();
  private readonly itemBehaviors = new Map<string, ItemBehavior<TItemContext>>();
  private readonly itemAliases = new Map<string, string>();
  private readonly entityBehaviors = new Map<string, EntityBehavior<TEntityContext>>();
  private readonly entityAliases = new Map<string, string>();

  registerBlock(aliases: string | readonly string[], behavior: BlockBehavior<TBlockContext>): void {
    this.blockBehaviors.set(behavior.id, behavior);
    for (const alias of typeof aliases === 'string' ? [aliases] : aliases) {
      this.blockAliases.set(alias, behavior.id);
    }
  }

  registerItem(aliases: string | readonly string[], behavior: ItemBehavior<TItemContext>): void {
    this.itemBehaviors.set(behavior.id, behavior);
    for (const alias of typeof aliases === 'string' ? [aliases] : aliases) {
      this.itemAliases.set(alias, behavior.id);
    }
  }

  registerEntity(aliases: string | readonly string[], behavior: EntityBehavior<TEntityContext>): void {
    this.entityBehaviors.set(behavior.id, behavior);
    for (const alias of typeof aliases === 'string' ? [aliases] : aliases) {
      this.entityAliases.set(alias, behavior.id);
    }
  }

  getBlockBehavior(block: BlockDef): BlockBehavior<TBlockContext> | undefined {
    const behaviorId = block.behaviorId ?? this.blockAliases.get(block.name);
    return behaviorId ? this.blockBehaviors.get(behaviorId) : undefined;
  }

  getItemBehavior(item: ItemDef): ItemBehavior<TItemContext> | undefined {
    const behaviorId = item.behaviorId ?? this.itemAliases.get(item.name);
    return behaviorId ? this.itemBehaviors.get(behaviorId) : undefined;
  }

  interactBlock(context: TBlockContext): BehaviorResult | undefined {
    return this.getBlockBehavior(context.block)?.interact?.(context);
  }

  useItem(context: TItemContext): BehaviorResult | undefined {
    return this.getItemBehavior(context.item)?.use?.(context);
  }

  canStartItemUse(context: TItemContext): boolean {
    return this.getItemBehavior(context.item)?.canStartUse?.(context) ?? true;
  }

  startItemUse(context: TItemContext): BehaviorResult | undefined {
    return this.getItemBehavior(context.item)?.startUse?.(context);
  }

  continueItemUse(context: TItemContext, progress: ItemUseProgress): BehaviorResult | undefined {
    return this.getItemBehavior(context.item)?.continueUse?.(context, progress);
  }

  stopItemUse(context: TItemContext, progress: ItemUseStop): BehaviorResult | undefined {
    return this.getItemBehavior(context.item)?.stopUse?.(context, progress);
  }

  interactEntity(alias: string, context: TEntityContext): BehaviorResult | undefined {
    const behaviorId = this.entityAliases.get(alias);
    return behaviorId ? this.entityBehaviors.get(behaviorId)?.interact?.(context) : undefined;
  }

  preventsItemUse(context: TBlockContext): boolean {
    const value = this.getBlockBehavior(context.block)?.preventsItemUse;
    return typeof value === 'function' ? value(context) : value ?? false;
  }
}
