"""Renderer for verifiable GLB previews (VTK software offscreen)."""
import os, numpy as np, trimesh, vtk
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
from PIL import Image
BASE=os.path.dirname(__file__);MODEL=os.path.join(BASE,'sd_e10_casa_oliva.glb')
scene=trimesh.load(MODEL,force='scene')

def make_actor(mesh):
 vertices=np.asarray(mesh.vertices,dtype=np.float32)
 faces=np.asarray(mesh.faces,dtype=np.int64)
 poly=vtk.vtkPolyData();pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(vertices,deep=True));poly.SetPoints(pts)
 cells=np.empty((faces.shape[0],4),np.int64);cells[:,0]=3;cells[:,1:]=faces
 ca=vtk.vtkCellArray();ca.SetCells(len(faces),numpy_to_vtkIdTypeArray(cells.ravel(),deep=True));poly.SetPolys(ca)
 normals=vtk.vtkPolyDataNormals();normals.SetInputData(poly);normals.ComputePointNormalsOn();normals.SplittingOn();normals.ConsistencyOn();normals.AutoOrientNormalsOff();normals.Update()
 poly=normals.GetOutput()
 uv=np.array(mesh.visual.uv,dtype=np.float32)
 if len(uv)==len(mesh.vertices):
  coords=vtk.vtkFloatArray();coords.SetNumberOfComponents(2);coords.SetName('TCoords');coords.SetNumberOfTuples(len(uv))
  for i,(u,v) in enumerate(uv):coords.SetTuple2(i,float(u),float(v))
  poly.GetPointData().SetTCoords(coords)
 mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
 actor=vtk.vtkActor();actor.SetMapper(mapper)
 m=mesh.visual.material
 teximage=m.baseColorTexture if hasattr(m,'baseColorTexture') else None
 if teximage is not None:
  im=teximage.convert('RGB');raw=np.array(im.transpose(Image.Transpose.FLIP_TOP_BOTTOM),dtype=np.uint8)
  imp=vtk.vtkImageImport();imp.CopyImportVoidPointer(raw.tobytes(),len(raw.tobytes()));imp.SetDataScalarTypeToUnsignedChar();imp.SetNumberOfScalarComponents(3);imp.SetWholeExtent(0,raw.shape[1]-1,0,raw.shape[0]-1,0,0);imp.SetDataExtentToWholeExtent();imp.Update()
  t=vtk.vtkTexture();t.SetInputConnection(imp.GetOutputPort());t.InterpolateOn();t.RepeatOn();actor.SetTexture(t)
 actor.GetProperty().SetAmbient(.42);actor.GetProperty().SetDiffuse(.58);actor.GetProperty().SetSpecular(.06);actor.GetProperty().SetSpecularPower(16)
 return actor

def preview(out,camera,target=(0,3,0),scale=9.5,orthographic=True):
 ren=vtk.vtkRenderer();ren.SetBackground(.84,.86,.87);ren.SetBackground2(.96,.96,.95);ren.GradientBackgroundOn()
 ren.SetUseDepthPeeling(False)
 for name,mesh in scene.geometry.items():
  if '_LOD0_' not in name:continue
  ren.AddActor(make_actor(mesh))
 # plane is render-stage only, not exported in GLB
 plane=vtk.vtkPlaneSource();plane.SetOrigin(-12,-.015,-15);plane.SetPoint1(12,-.015,-15);plane.SetPoint2(-12,-.015,15);plane.Update()
 m=vtk.vtkPolyDataMapper();m.SetInputConnection(plane.GetOutputPort());a=vtk.vtkActor();a.SetMapper(m);a.GetProperty().SetColor(.70,.69,.65);a.GetProperty().SetAmbient(.50);a.GetProperty().SetDiffuse(.5);ren.AddActor(a)
 light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(-7,15,13);light.SetFocalPoint(0,2,0);light.SetIntensity(1.06);light.SetColor(1.0,.94,.84);ren.AddLight(light)
 fill=vtk.vtkLight();fill.SetPosition(12,5,-11);fill.SetFocalPoint(0,2,0);fill.SetIntensity(.53);fill.SetColor(.78,.85,1.0);ren.AddLight(fill)
 cam=ren.GetActiveCamera();cam.SetPosition(*camera);cam.SetFocalPoint(*target);cam.SetViewUp(0,1,0)
 if orthographic:cam.ParallelProjectionOn();cam.SetParallelScale(scale)
 else:cam.SetViewAngle(37)
 ren.ResetCameraClippingRange()
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(1440,960);win.AddRenderer(ren)
 win.SetMultiSamples(8)
 win.Render();f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.SetScale(1);f.SetInputBufferTypeToRGB();f.ReadFrontBufferOff();f.Update();writer=vtk.vtkPNGWriter();writer.SetFileName(out);writer.SetInputConnection(f.GetOutputPort());writer.Write()
 print(out)

preview(os.path.join(BASE,'vista_tres_cuartos.png'),(11,9,15),(0,3,0),7.6)
preview(os.path.join(BASE,'vista_fachada.png'),(0,6,18),(0,3.05,0),6.3)
preview(os.path.join(BASE,'vista_lateral.png'),(15,7.2,-3),(0,3,0),8.0)
