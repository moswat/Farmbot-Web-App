import React from "react";
import { sortGroupBy, sortOptionsTable } from "./point_group_sort";
import { sortBy, uniq } from "lodash";
import { PointGroupSortType } from "farmbot/dist/resources/api_resources";
import { t } from "../i18next_wrapper";
import { Actions } from "../constants";
import { edit, save } from "../api/crud";
import { TaggedPointGroup, TaggedPoint } from "farmbot";
import { error } from "../toast/toast";
import { DevSettings } from "../settings/dev/dev_support";

export const xy = (point: TaggedPoint) => ({ x: point.body.x, y: point.body.y });

const distance = (p1: { x: number, y: number }, p2: { x: number, y: number }) =>
  Math.pow(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2), 0.5);

const pathDistance = (pathPoints: TaggedPoint[]) => {
  let total = 0;
  let prev: { x: number, y: number } | undefined = undefined;
  pathPoints.map(xy)
    .map(p => {
      prev ? total += distance(p, prev) : 0;
      prev = p;
    });
  return Math.round(total);
};

const findNearest =
  (from: { x: number, y: number }, available: TaggedPoint[]) => {
    const distances = available.map(p => ({
      point: p, distance: distance(xy(p), from)
    }));
    return sortBy(distances, "distance")[0].point;
  };

export const nn = (pathPoints: TaggedPoint[]) => {
  let available = pathPoints.slice(0);
  const ordered: TaggedPoint[] = [];
  let from = { x: 0, y: 0 };
  pathPoints.map(() => {
    if (available.length < 1) { return; }
    const nearest = findNearest(from, available);
    ordered.push(nearest);
    from = { x: nearest.body.x, y: nearest.body.y };
    available = available.filter(p => p.uuid !== nearest.uuid);
  });
  return ordered;
};

export const alternating = (pathPoints: TaggedPoint[], axis: "xy" | "yx") => {
  const axis0: "x" | "y" = axis[0] as "x" | "y";
  const axis1: "x" | "y" = axis[1] as "x" | "y";
  const ordered: TaggedPoint[] = [];
  const rowCoordinates = sortBy(uniq(pathPoints.map(p => p.body[axis0])));
  const rows = rowCoordinates.map((rowCoordinate, index) => {
    const row = sortBy(pathPoints.filter(p =>
      p.body[axis0] == rowCoordinate), "body." + axis1);
    return index % 2 == 0 ? row : row.reverse();
  });
  rows.map(row => row.map(p => ordered.push(p)));
  return ordered;
};

export type ExtendedPointGroupSortType = PointGroupSortType
  | "nn" | "xy_alternating" | "yx_alternating";

const SORT_TYPES: ExtendedPointGroupSortType[] = [
  "random", "xy_ascending", "xy_descending", "yx_ascending", "yx_descending"];

export interface PathInfoBarProps {
  sortTypeKey: ExtendedPointGroupSortType;
  dispatch: Function;
  group: TaggedPointGroup;
  pathData: { [key: string]: number };
}

export const PathInfoBar = (props: PathInfoBarProps) => {
  const { sortTypeKey, dispatch, group } = props;
  const pathLength = props.pathData[sortTypeKey];
  const maxLength = Math.max(...Object.values(props.pathData));
  const normalizedLength = pathLength / maxLength * 100;
  const sortLabel = () => {
    switch (sortTypeKey) {
      case "nn": return "Optimized";
      case "xy_alternating": return "X/Y Alternating";
      case "yx_alternating": return "Y/X Alternating";
      default: return sortOptionsTable()[sortTypeKey];
    }
  };
  const selected = group.body.sort_type == sortTypeKey;
  return <div className={`sort-option-bar ${selected ? "selected" : ""}`}
    onMouseEnter={() =>
      dispatch({ type: Actions.TRY_SORT_TYPE, payload: sortTypeKey })}
    onMouseLeave={() =>
      dispatch({ type: Actions.TRY_SORT_TYPE, payload: undefined })}
    onClick={() => {
      if (sortTypeKey == "nn" || sortTypeKey == "xy_alternating"
        || sortTypeKey == "yx_alternating") {
        error(t("Not supported yet."));
      } else {
        dispatch(edit(group, { sort_type: sortTypeKey }));
        dispatch(save(group.uuid));
      }
    }}>
    <div className={"sort-path-info-bar"}
      style={{ width: `${normalizedLength}%` }}>
      {`${sortLabel()}: ${Math.round(pathLength / 10) / 100}m`}
    </div>
  </div>;
};

export interface PathsProps {
  pathPoints: TaggedPoint[];
  dispatch: Function;
  group: TaggedPointGroup;
}

interface PathsState {
  pathData: Record<string, number>;
}

export class Paths extends React.Component<PathsProps, PathsState> {
  state: PathsState = { pathData: {} };

  generatePathData = (pathPoints: TaggedPoint[]) => {
    const newPathData: Record<string, number> = {};
    SORT_TYPES.map((sortType: PointGroupSortType) =>
      newPathData[sortType] = pathDistance(sortGroupBy(sortType, pathPoints)));
    newPathData.xy_alternating = pathDistance(alternating(pathPoints, "xy"));
    newPathData.yx_alternating = pathDistance(alternating(pathPoints, "yx"));
    newPathData.nn = pathDistance(nn(pathPoints));
    this.setState({ pathData: newPathData });
  };

  componentDidMount = () => this.generatePathData(this.props.pathPoints);

  render() {
    return <div className={"group-sort-types"}>
      {SORT_TYPES
        .concat(DevSettings.futureFeaturesEnabled()
          ? ["xy_alternating", "yx_alternating", "nn"]
          : [])
        .map(sortType =>
          <PathInfoBar key={sortType}
            sortTypeKey={sortType}
            dispatch={this.props.dispatch}
            group={this.props.group}
            pathData={this.state.pathData} />)}
    </div>;
  }
}
