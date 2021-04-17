import { WebMap } from '@xizher/cesium'
import { baseUtils } from '@xizher/js-utils'
import Observer from '@xizher/observer'
import {
  RectangleGraphics,
  Color,
  Math as CesiumMath,
  Entity,
  Rectangle,
  Cartesian3,
  HeadingPitchRange,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium'
import PointGraphics from 'cesium/Source/DataSources/PointGraphics'

/** 跳跃方向 */
type JumpDirection = 'to-east' | 'to-north'

interface IBox {
  target: Entity
  lon: number
  lat: number
}

export class MapJumpGame extends Observer<{
  'game-over': void
  'game-start': void
}> {

  //#region 私有属性

  private _webMap: WebMap

  private _jumpEntityId = baseUtils.createGuid()

  private _jumpDirection: JumpDirection = 'to-east'

  private _speed = 0

  private _targetBox: IBox | null = null

  private _sourceBox: IBox | null = null

  private _options = {
    startLonLat: [113.1805, 23.1205],
    boxSize: { height: 50, widthHalf: .0005 },
    startSpeed: .0001,
    distanceMaxMin: { min: 15, max: 45 },
  }

  private _jumpPointStyle: PointGraphics.ConstructorOptions = {
    color: Color.BLACK,
    outlineColor: Color.WHITE,
    outlineWidth: 4,
    pixelSize: 28,
  }

  //#endregion

  //#region getter

  private get _isJumpEast () : boolean {
    return this._jumpDirection === 'to-east'
  }

  private get _boxStyle () : RectangleGraphics.ConstructorOptions {
    return {
      outline: true,
      outlineColor: Color.WHITE,
      outlineWidth: 4,
      stRotation: CesiumMath.toRadians(45),
      material: Color.fromRandom({ alpha: 1.0 }),
    }
  }

  //#endregion

  //#region 构造函数

  constructor (webMap: WebMap) {
    super()
    this._webMap = webMap
  }

  //#endregion

  //#region 私有方法

  private _createBox (lon: number, lat: number) : Entity {
    const id = baseUtils.createGuid()
    const { widthHalf, height } = this._options.boxSize
    const [xmin, ymin] = [lon - widthHalf, lat - widthHalf]
    const [xmax, ymax] = [lon + widthHalf, lat + widthHalf]
    this._webMap.mapEntities?.addEntities({
      id, rectangle: {
        ...this._boxStyle,
        coordinates: Rectangle.fromDegrees(xmin, ymin, xmax, ymax),
        extrudedHeight: height,
      }
    })
    const entity = this._webMap.entities.getById(id) as Entity
    return entity
  }

  private _createDistance () : number {
    const { min, max } = this._options.distanceMaxMin
    return baseUtils.createIntRandom(min, max) / 10000
  }

  private _createNextJumpBox () {
    const [lon, lat] = this._options.startLonLat
    if (!this._sourceBox) {
      this._sourceBox = {
        lon, lat,
        target: this._createBox(lon, lat),
      }
      this._targetBox = {
        target: this._sourceBox.target,
        lon, lat,
      }
      this._setJumpPoint(lon, lat, this._options.boxSize.height)
      this._createNextJumpBox()
      return
    }
    const targetBox = this._targetBox as IBox
    this._sourceBox.lon = targetBox.lon
    this._sourceBox.lat = targetBox.lat
    this._jumpDirection = baseUtils.createIntRandom(0, 1) === 0 ? 'to-east' : 'to-north'
    let heading = -90
    if (this._isJumpEast) {
      heading = 0
      targetBox.lon = this._sourceBox.lon + this._createDistance()
      targetBox.lat = this._sourceBox.lat
    } else {
      targetBox.lon = this._sourceBox.lon
      targetBox.lat = this._sourceBox.lat + this._createDistance()
    }
    this._sourceBox.target = targetBox.target
    this._targetBox = {
      target: this._createBox(targetBox.lon, targetBox.lat),
      lon: targetBox.lon,
      lat: targetBox.lat,
    }
    this._webMap.viewer.flyTo([(this._sourceBox as IBox).target, this._targetBox.target], {
      duration: 1, offset: new HeadingPitchRange(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(-45)
      )
    })
  }

  private _setJumpPoint (lon: number, lat: number, height: number) {
    const entity = this._webMap.entities.getById(this._jumpEntityId)
    entity && this._webMap.mapEntities?.removeEntities(entity)
    this._webMap.mapEntities?.addEntities({
      id: this._jumpEntityId,
      position: Cartesian3.fromDegrees(lon, lat, height),
      point: this._jumpPointStyle
    })
  }

  private _initjumpEvent () {
    let handlerId: number
    const handler = new ScreenSpaceEventHandler(this._webMap.scene.canvas)
    handler.setInputAction(() => {
      this._speed = this._options.startSpeed
      handlerId = setInterval(() => {
        this._setSourceBoxHeight()
        this._speed += .000175
      }, 100)
    }, ScreenSpaceEventType.LEFT_DOWN)
    handler.setInputAction(() => {
      clearInterval(handlerId)
      this._setSourceBoxHeight(this._options.boxSize.height)
      this._jump().then(result => {
        if (result) {
          this._createNextJumpBox()
        } else {
          handler.destroy()
          this._webMap.viewer.flyTo(this._webMap.entities, {
            offset: new HeadingPitchRange(
              CesiumMath.toRadians(0),
              CesiumMath.toRadians(-90)
            )
          })
        }
      })
    }, ScreenSpaceEventType.LEFT_UP)
  }

  private _setSourceBoxHeight (height?: number) {
    const extrudedHeight = this._sourceBox?.target?.rectangle?.extrudedHeight
    if (!extrudedHeight) {
      return
    }
    if (height) {
      // eslint-disable-next-line
      // @ts-ignore
      extrudedHeight.setValue(height)
    } else {
      // eslint-disable-next-line
      // @ts-ignore
      extrudedHeight.setValue(extrudedHeight.getValue() - 1)
    }
  }

  private _jump () : Promise<boolean> {
    return new Promise(resolve => {
      const sourceBox = this._sourceBox as IBox
      const targetBox = this._targetBox as IBox
      const start = this._isJumpEast ? sourceBox.lon : sourceBox.lat
      const trueEnd = this._isJumpEast ? targetBox.lon : targetBox.lat
      const end = start + this._speed
      const [x] = this._lonlatToWebMercator(start, 0)
      const [tx] = this._lonlatToWebMercator(end, 0)
      const r = Math.abs((tx - x)) / 2
      const center = x + r
      const a = center
      const b = this._options.boxSize.height
      let tempValue = start
      const handler = setInterval(() => {
        tempValue += .00005

        if (tempValue >= end) {
          clearInterval(handler)
          if (Math.abs(trueEnd - end) < this._options.boxSize.widthHalf) {
            this._isJumpEast
              ? targetBox.lon = end
              : targetBox.lat = end
            resolve(true)
          } else {
            this.fire('game-over')
            resolve(false)
          }
        }
        const tempHeight = Math.sqrt(r ** 2 - (this._lonlatToWebMercator(tempValue, 0)[0] - a) ** 2) + b
        const position: [number, number, number] = this._isJumpEast
          ? [tempValue >= end ? end : tempValue, sourceBox.lat, tempValue >= end ? 50 : tempHeight]
          : [sourceBox.lon, tempValue >= end ? end : tempValue, tempValue >= end ? 50 : tempHeight]
        this._setJumpPoint(...position)
      }, 10)
    })
  }

  private _lonlatToWebMercator (lon: number, lat: number) : [number, number] {
    const x = lon * 20037508.34 / 180
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)
    y = y * 20037508.34 / 180
    return [x, y]
  }

  //#endregion

  //#region 公有方法

  public resetGame () : void {
    this._sourceBox = null
    this._webMap.mapEntities?.clearEntities()
    this.startGame()
  }

  public startGame () : void {
    this._createNextJumpBox()
    this._initjumpEvent()
    this.fire('game-start')
  }

  //#endregion

}
